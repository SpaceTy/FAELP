package api

import "github.com/go-chi/chi/v5"

func Routes(handler *Handler) chi.Router {
	r := chi.NewRouter()

	r.Use(CORS)

	r.Route("/requests", func(r chi.Router) {
		r.Post("/", handler.CreateRequest)
		r.Get("/", handler.ListRequests)
		r.Get("/subscribe", handler.SubscribeRequests)
		r.Get("/{id}", handler.GetRequest)
		r.Get("/{id}/subscribe", handler.SubscribeRequest)
	})

	// My Requests endpoint - separate from ListRequests for different auth
	r.Get("/my-requests", handler.GetMyRequests)

	return r
}
