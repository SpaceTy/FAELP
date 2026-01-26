module organization_backend

go 1.22

require (
	github.com/go-chi/chi/v5 v5.0.10
	github.com/google/uuid v1.6.0
	github.com/lib/pq v1.10.9
	github.com/yourusername/database_handler v0.0.0-00010101000000-000000000000
	gopkg.in/yaml.v3 v3.0.1
)

replace github.com/yourusername/database_handler => ../database_handler
