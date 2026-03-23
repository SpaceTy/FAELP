package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// SPAHandler serves a single-page application from a directory
// It serves static files directly and falls back to index.html for client-side routing
type SPAHandler struct {
	staticPath string
	indexPath  string
}

// NewSPAHandler creates a new SPA handler for serving static files
func NewSPAHandler(staticPath string) *SPAHandler {
	return &SPAHandler{
		staticPath: staticPath,
		indexPath:  filepath.Join(staticPath, "index.html"),
	}
}

// ServeHTTP implements http.Handler interface
func (h *SPAHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Clean the path to prevent directory traversal
	path := filepath.Clean(r.URL.Path)

	// If path is root or empty, serve index.html
	if path == "/" || path == "." {
		h.serveIndex(w, r)
		return
	}

	// Remove leading slash for file lookup
	path = strings.TrimPrefix(path, "/")

	// Construct full file path
	fullPath := filepath.Join(h.staticPath, path)

	// Check if file exists and is not a directory
	info, err := os.Stat(fullPath)
	if err == nil && !info.IsDir() {
		h.setCacheHeaders(w, path)
		http.ServeFile(w, r, fullPath)
		return
	}

	// Try with .html extension for clean URLs
	if !strings.Contains(path, ".") {
		htmlPath := fullPath + ".html"
		info, err = os.Stat(htmlPath)
		if err == nil && !info.IsDir() {
			h.setCacheHeaders(w, path+".html")
			http.ServeFile(w, r, htmlPath)
			return
		}
	}

	// File not found, serve index.html for client-side routing
	h.serveIndex(w, r)
}

// serveIndex serves the index.html file
func (h *SPAHandler) serveIndex(w http.ResponseWriter, r *http.Request) {
	// Check if index.html exists
	_, err := os.Stat(h.indexPath)
	if err != nil {
		http.Error(w, "index.html not found", http.StatusNotFound)
		return
	}

	h.setNoCacheHeaders(w)
	http.ServeFile(w, r, h.indexPath)
}

func (h *SPAHandler) setCacheHeaders(w http.ResponseWriter, path string) {
	cleanPath := strings.TrimPrefix(filepath.ToSlash(path), "/")

	switch {
	case strings.EqualFold(filepath.Base(cleanPath), "index.html"):
		h.setNoCacheHeaders(w)
	case strings.HasSuffix(strings.ToLower(cleanPath), ".html"):
		h.setNoCacheHeaders(w)
	case strings.HasPrefix(cleanPath, "assets/"):
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	default:
		w.Header().Set("Cache-Control", "no-cache")
	}
}

func (h *SPAHandler) setNoCacheHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
}
