package api

import "github.com/go-chi/chi/v5"

func Routes(handler *Handler, authHandler *AuthHandler, jwtSecret string) chi.Router {
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

	return r
}
