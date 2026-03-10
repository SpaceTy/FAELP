package api

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/chai2010/webp"
	"github.com/go-chi/chi/v5"
	"golang.org/x/image/draw"
)

// UploadHandler handles file uploads
type UploadHandler struct {
	Store      StoreInterface
	UploadPath string
}

// UploadMaterialTypeImage handles image upload for material types
func (h *UploadHandler) UploadMaterialTypeImage(w http.ResponseWriter, r *http.Request) {
	const maxUploadBytes = 12 << 20 // 12MB hard limit on request body
	id := chi.URLParam(r, "id")

	// Check material type exists
	_, err := h.Store.GetMaterialTypeByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Material type not found")
		return
	}

	// Parse multipart form with 10MB max memory
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "file_too_large", "Image exceeds upload size limit")
			return
		}
		log.Printf("ERROR UploadMaterialTypeImage id=%q parse form: %v", id, err)
		writeError(w, http.StatusBadRequest, "invalid_form", "Failed to parse form")
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("image")
	if err != nil {
		log.Printf("ERROR UploadMaterialTypeImage id=%q form file: %v", id, err)
		writeError(w, http.StatusBadRequest, "missing_file", "No image file provided")
		return
	}
	defer file.Close()

	contentType := normalizeContentType(header.Header.Get("Content-Type"))
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		log.Printf("ERROR UploadMaterialTypeImage id=%q read: %v", id, err)
		writeError(w, http.StatusBadRequest, "read_error", "Failed to read image")
		return
	}

	detectedType := normalizeContentType(http.DetectContentType(fileBytes))
	if !isValidImageType(contentType) && !isValidImageType(detectedType) {
		log.Printf("ERROR UploadMaterialTypeImage id=%q invalid type content-type=%q detected=%q", id, contentType, detectedType)
		writeError(w, http.StatusBadRequest, "invalid_type", "Invalid image type. Allowed: jpeg, png, webp, gif")
		return
	}

	// Prefer detected type (from actual bytes) over the header, which browsers sometimes set incorrectly.
	// Only fall back to header content-type if detection returns a generic type.
	decodeType := detectedType
	if detectedType == "application/octet-stream" && isValidImageType(contentType) {
		decodeType = contentType
	}

	// Decode the image
	img, format, err := decodeImage(bytes.NewReader(fileBytes), decodeType)
	if err != nil {
		log.Printf("ERROR UploadMaterialTypeImage id=%q decode type=%q: %v", id, decodeType, err)
		writeError(w, http.StatusBadRequest, "decode_error", "Failed to decode image")
		return
	}

	// Resize image to standard dimensions (400x300) while maintaining aspect ratio
	img = resizeImage(img, 400, 300)

	// Create uploads directory if it doesn't exist
	uploadDir := filepath.Join(h.UploadPath, "material-types")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "mkdir_error", "Failed to create upload directory")
		return
	}

	// Generate a versioned filename so changed images get a new URL and bypass stale caches.
	imageHash := sha256.Sum256(fileBytes)
	filename := fmt.Sprintf("%s-%s.webp", id, hex.EncodeToString(imageHash[:])[:12])
	outputPath := filepath.Join(uploadDir, filename)

	// Create the output file
	outFile, err := os.Create(outputPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "file_error", "Failed to create file")
		return
	}
	defer outFile.Close()

	// Encode as webp
	if err := encodeWebP(outFile, img); err != nil {
		writeError(w, http.StatusInternalServerError, "encode_error", "Failed to encode image")
		return
	}

	// Generate the URL (relative path for production flexibility)
	imageURL := fmt.Sprintf("/uploads/material-types/%s", filename)

	// Update the material type with the new image URL
	if err := h.Store.UpdateMaterialTypeImage(r.Context(), id, imageURL); err != nil {
		writeError(w, http.StatusInternalServerError, "update_error", "Failed to update material type")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"imageUrl": imageURL,
		"format":   format,
	})
}

// isValidImageType checks if the content type is a valid image type
func isValidImageType(contentType string) bool {
	contentType = normalizeContentType(contentType)
	validTypes := []string{
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/webp",
		"image/gif",
	}
	for _, t := range validTypes {
		if strings.EqualFold(contentType, t) {
			return true
		}
	}
	return false
}

// decodeImage decodes an image from a reader based on content type
func decodeImage(r io.Reader, contentType string) (image.Image, string, error) {
	contentType = normalizeContentType(contentType)
	switch contentType {
	case "image/jpeg", "image/jpg":
		img, err := jpeg.Decode(r)
		return img, "jpeg", err
	case "image/png":
		img, err := png.Decode(r)
		return img, "png", err
	case "image/webp":
		img, err := webp.Decode(r)
		return img, "webp", err
	case "image/gif":
		img, format, err := image.Decode(r)
		return img, format, err
	default:
		// Try to detect format automatically
		img, format, err := image.Decode(r)
		return img, format, err
	}
}

func normalizeContentType(contentType string) string {
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err == nil {
		return strings.ToLower(strings.TrimSpace(mediaType))
	}
	return strings.ToLower(strings.TrimSpace(contentType))
}

// resizeImage resizes an image to fit within maxWidth and maxHeight while maintaining aspect ratio
// Uses high-quality bilinear interpolation for smooth scaling
func resizeImage(img image.Image, maxWidth, maxHeight int) image.Image {
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Calculate scaling factors
	scaleX := float64(maxWidth) / float64(width)
	scaleY := float64(maxHeight) / float64(height)
	scale := scaleX
	if scaleY < scale {
		scale = scaleY
	}

	// Only scale down, never up
	if scale >= 1 {
		return img
	}

	newWidth := int(float64(width) * scale)
	newHeight := int(float64(height) * scale)

	// Create new image with the calculated size
	newImg := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))

	// Use high-quality bilinear scaling via draw.CatmullRom (cubic interpolation)
	// for smoother results than nearest neighbor
	draw.CatmullRom.Scale(newImg, newImg.Bounds(), img, bounds, draw.Over, nil)

	return newImg
}

// encodeWebP encodes an image to webp format with very high quality (95)
// Using lossy compression with high quality for excellent visual fidelity
func encodeWebP(w io.Writer, img image.Image) error {
	// Encode with quality 95 for very high quality
	// WebP quality 95 provides excellent visual fidelity with reasonable file sizes
	return webp.Encode(w, img, &webp.Options{
		Quality: 95,
	})
}
