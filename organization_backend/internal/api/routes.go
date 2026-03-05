package api

import (
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
)

func Routes(handler *Handler, authHandler *AuthHandler, materialTypeHandler *MaterialTypeHandler, uploadHandler *UploadHandler, dcHandler *DistributionCenterHandler, requestHandler *RequestHandler, jwtSecret string) chi.Router {
	r := chi.NewRouter()

	// Recovery must be first to catch all panics
	r.Use(RecoveryMiddleware)
	r.Use(CORS)
	r.Use(DebugMiddleware)

	// Internal middleware to detect Unix socket requests
	r.Use(InternalMiddleware())

	// API routes - all prefixed with /api
	r.Route("/api", func(r chi.Router) {
		// Public auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/magic-link", authHandler.RequestMagicLink)
			r.Post("/callback", authHandler.MagicLinkCallback)
			r.With(AuthMiddleware(jwtSecret)).Get("/me", authHandler.GetCurrentUser)
		})

		// Material Types routes
		r.Route("/material-types", func(r chi.Router) {
			// Public routes
			r.Get("/", materialTypeHandler.ListMaterialTypes)
			r.Get("/{id}", materialTypeHandler.GetMaterialType)
			// SSE endpoint for real-time material availability updates
			r.Get("/subscribe", handler.SubscribeMaterialAvailability)

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

		// Distribution Centers routes (admin only)
		r.Route("/distribution-centers", func(r chi.Router) {
			r.Use(AuthMiddleware(jwtSecret))
			r.Use(AdminMiddleware())
			r.Get("/", dcHandler.ListDistributionCenters)
			r.Post("/", dcHandler.CreateDistributionCenter)
			r.Get("/{id}", dcHandler.GetDistributionCenter)
			r.Put("/{id}", dcHandler.UpdateDistributionCenter)
			r.Delete("/{id}", dcHandler.DeleteDistributionCenter)
		})

		// Requests routes (authenticated users)
		r.Route("/requests", func(r chi.Router) {
			r.Use(AuthMiddleware(jwtSecret))
			r.Post("/", requestHandler.CreateRequest)
			r.Get("/my", requestHandler.ListMyRequests)
			r.Get("/subscribe", requestHandler.SubscribeMyRequests)
			r.Post("/{id}/cancel", requestHandler.CancelMyRequest)
		})
	})

	// Internal endpoints (not part of /api prefix - Unix socket only)
	// Internal endpoint for registering co-located dist backends (Unix socket only)
	r.Post("/internal/register-dist-backend", dcHandler.RegisterDistBackend)

	// Internal endpoint for receiving availability updates from dist backends (Unix socket only)
	r.Post("/internal/availability", handler.UpdateAvailabilityFromDistBackend)

	// Internal endpoint for listing requests (Unix socket preferred; HTTP requires API key)
	r.With(APIKeyMiddleware()).Get("/internal/requests", requestHandler.ListRequestsForDistribution)
	r.With(APIKeyMiddleware()).Post("/internal/requests/{id}/approve", requestHandler.ApproveRequestForDistribution)
	r.With(APIKeyMiddleware()).Post("/internal/requests/{id}/in-action", requestHandler.MarkRequestInActionForDistribution)
	r.With(APIKeyMiddleware()).Post("/internal/requests/{id}/cancel", requestHandler.CancelAssignedRequestForDistribution)
	r.With(APIKeyMiddleware()).Post("/internal/requests/{id}/archive", requestHandler.ArchiveRequestForDistribution)
	r.With(APIKeyMiddleware()).Post("/internal/requests/{id}/unarchive", requestHandler.UnarchiveRequestForDistribution)

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
