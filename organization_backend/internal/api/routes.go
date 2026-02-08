package api

import (
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
)

func Routes(handler *Handler, authHandler *AuthHandler, materialTypeHandler *MaterialTypeHandler, uploadHandler *UploadHandler, jwtSecret string) chi.Router {
	r := chi.NewRouter()

	r.Use(CORS)

	// Public auth routes
	r.Route("/auth", func(r chi.Router) {
		r.Post("/magic-link", authHandler.RequestMagicLink)
		r.Post("/callback", authHandler.MagicLinkCallback)
		r.With(AuthMiddleware(jwtSecret)).Get("/me", authHandler.GetCurrentUser)
	})

	// Protected routes
	r.Route("/requests", func(r chi.Router) {
		r.Use(AuthMiddleware(jwtSecret))
		r.Post("/", handler.CreateRequest)
		r.Get("/", handler.ListRequests)
		r.Get("/subscribe", handler.SubscribeRequests)
		r.Get("/{id}", handler.GetRequest)
		r.Get("/{id}/subscribe", handler.SubscribeRequest)
	})

	// My Requests - protected
	r.With(AuthMiddleware(jwtSecret)).Get("/my-requests", handler.GetMyRequests)

	// Material Types routes
	r.Route("/material-types", func(r chi.Router) {
		// Public routes
		r.Get("/", materialTypeHandler.ListMaterialTypes)
		r.Get("/{id}", materialTypeHandler.GetMaterialType)

		// Admin only routes
		r.Group(func(r chi.Router) {
			r.Use(AuthMiddleware(jwtSecret))
			r.Use(AdminMiddleware())
			r.Post("/", materialTypeHandler.CreateMaterialType)
			r.Put("/{id}", materialTypeHandler.UpdateMaterialType)
			r.Delete("/{id}", materialTypeHandler.DeleteMaterialType)
			r.Post("/{id}/image", uploadHandler.UploadMaterialTypeImage)
		})
	})

	// Static file serving for uploads
	uploadsDir := uploadHandler.UploadPath
	if uploadsDir == "" {
		uploadsDir = "uploads"
	}
	// Ensure uploads directory exists
	os.MkdirAll(uploadsDir, 0755)
	fileServer := http.FileServer(http.Dir(uploadsDir))
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", fileServer))

	return r
}
