package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"distribution_backend/internal/client"
)

var materialTypeIDSanitizer = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

func sanitizeMaterialTypeID(input string) string {
	s := materialTypeIDSanitizer.ReplaceAllString(strings.TrimSpace(input), "_")
	if s == "" {
		return "unknown"
	}
	return s
}

func imageExtensionFromURL(raw string) string {
	base := raw
	if idx := strings.Index(base, "?"); idx >= 0 {
		base = base[:idx]
	}
	ext := strings.ToLower(filepath.Ext(base))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return ext
	default:
		return ".webp"
	}
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

func syncMaterialTypeImages(ctx context.Context, orgClient *client.OrgClient, uploadPath string, materialTypes []client.MaterialType) map[string]string {
	result := map[string]string{}
	if orgClient == nil {
		return result
	}

	baseDir := filepath.Join(uploadPath, "material-types")
	_ = os.MkdirAll(baseDir, 0755)

	for _, mt := range materialTypes {
		if strings.TrimSpace(mt.ImageURL) == "" {
			continue
		}

		sourceHash := sha256.Sum256([]byte(mt.ImageURL))
		localName := fmt.Sprintf(
			"%s-%s%s",
			sanitizeMaterialTypeID(mt.ID),
			hex.EncodeToString(sourceHash[:])[:12],
			imageExtensionFromURL(mt.ImageURL),
		)
		localPath := filepath.Join(baseDir, localName)
		localURL := fmt.Sprintf("/uploads/material-types/%s", localName)
		if fileExists(localPath) {
			result[mt.ID] = localURL
			continue
		}

		imageData, err := orgClient.GetAsset(ctx, mt.ImageURL)
		if err != nil {
			result[mt.ID] = mt.ImageURL
			continue
		}

		if err := os.WriteFile(localPath, imageData, 0644); err != nil {
			result[mt.ID] = mt.ImageURL
			continue
		}

		result[mt.ID] = localURL
	}

	return result
}
