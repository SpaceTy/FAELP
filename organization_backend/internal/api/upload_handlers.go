package api

import (
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/chai2010/webp"
	"github.com/go-chi/chi/v5"
)

// UploadHandler handles file uploads
type UploadHandler struct {
	Store      StoreInterface
	UploadPath string
}

// UploadMaterialTypeImage handles image upload for material types
func (h *UploadHandler) UploadMaterialTypeImage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Check material type exists
	_, err := h.Store.GetMaterialTypeByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Material type not found")
		return
	}

	// Parse multipart form with 10MB max memory
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_form", "Failed to parse form")
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing_file", "No image file provided")
		return
	}
	defer file.Close()

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	if !isValidImageType(contentType) {
		writeError(w, http.StatusBadRequest, "invalid_type", "Invalid image type. Allowed: jpeg, png, webp, gif")
		return
	}

	// Decode the image
	img, format, err := decodeImage(file, contentType)
	if err != nil {
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

	// Generate filename with webp extension
	filename := fmt.Sprintf("%s.webp", id)
	filepath := filepath.Join(uploadDir, filename)

	// Create the output file
	outFile, err := os.Create(filepath)
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
	default:
		// Try to detect format automatically
		img, format, err := image.Decode(r)
		return img, format, err
	}
}

// resizeImage resizes an image to fit within maxWidth and maxHeight while maintaining aspect ratio
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

	// Simple nearest neighbor scaling
	for y := 0; y < newHeight; y++ {
		for x := 0; x < newWidth; x++ {
			srcX := int(float64(x) / scale)
			srcY := int(float64(y) / scale)
			newImg.Set(x, y, img.At(srcX+bounds.Min.X, srcY+bounds.Min.Y))
		}
	}

	return newImg
}

// encodeWebP encodes an image to webp format with high quality (85)
// Using lossy compression for good quality/size ratio
func encodeWebP(w io.Writer, img image.Image) error {
	// Encode with quality 85 for high quality without excessive file size
	return webp.Encode(w, img, &webp.Options{
		Quality: 85,
		})
}
