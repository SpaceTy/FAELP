package config

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

// InternalConfig holds Unix socket configuration for inter-service communication
type InternalConfig struct {
	SocketPath    string `yaml:"socket_path"`
	SocketEnabled bool   `yaml:"socket_enabled"`
}

// DistBackendConfig holds configuration for connecting to distribution backend
type DistBackendConfig struct {
	SocketPath           string `yaml:"socket_path"`
	DistributionCenterID string `yaml:"distribution_center_id"`
}

// FrontendConfig for serving static frontend files
type FrontendConfig struct {
	Enabled bool   `yaml:"enabled"`
	Path    string `yaml:"path"`
}

// AdminFrontendConfig includes port for admin frontends
type AdminFrontendConfig struct {
	Enabled bool   `yaml:"enabled"`
	Port    int    `yaml:"port"`
	Path    string `yaml:"path"`
}

// Frontend holds all frontend configurations
type Frontend struct {
	User  FrontendConfig      `yaml:"user"`
	Admin AdminFrontendConfig `yaml:"admin"`
}

type Config struct {
	DatabaseURL    string `yaml:"DATABASE_URL"`
	WorkOSAPIKey   string
	WorkOSClientID string
	JWTSecret      string

	// Internal communication config
	Internal InternalConfig `yaml:"internal"`

	// Distribution backend connection
	DistBackend DistBackendConfig `yaml:"distribution_backend"`

	// Frontend serving configuration
	Frontend Frontend `yaml:"frontend"`
}

func Load() (Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load(".env")

	cfg := Config{}

	// Load file config when available so frontend/internal settings are applied.
	// If the config file is absent, allow env-only configuration.
	path := os.Getenv("CONFIG_PATH")
	if path == "" {
		path = "config.yaml"
	}
	data, err := os.ReadFile(filepath.Clean(path))
	if err == nil {
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return Config{}, err
		}
	} else if !os.IsNotExist(err) {
		return Config{}, err
	}

	// Apply environment overrides
	if url := os.Getenv("DATABASE_URL"); url != "" {
		cfg.DatabaseURL = url
	}
	if apiKey := os.Getenv("WORKOS_API_KEY"); apiKey != "" {
		cfg.WorkOSAPIKey = apiKey
	}
	if clientID := os.Getenv("WORKOS_CLIENT_ID"); clientID != "" {
		cfg.WorkOSClientID = clientID
	}
	if jwtSecret := os.Getenv("JWT_SECRET"); jwtSecret != "" {
		cfg.JWTSecret = jwtSecret
	}

	// Override internal config with environment variables if set
	if socketPath := os.Getenv("INTERNAL_SOCKET_PATH"); socketPath != "" {
		cfg.Internal.SocketPath = socketPath
	}
	if socketEnabled := os.Getenv("INTERNAL_SOCKET_ENABLED"); socketEnabled == "true" {
		cfg.Internal.SocketEnabled = true
	} else if socketEnabled == "false" {
		cfg.Internal.SocketEnabled = false
	}

	// Override distribution backend config with environment variables
	if distSocketPath := os.Getenv("DIST_BACKEND_SOCKET_PATH"); distSocketPath != "" {
		cfg.DistBackend.SocketPath = distSocketPath
	}
	if distCenterID := os.Getenv("DIST_BACKEND_CENTER_ID"); distCenterID != "" {
		cfg.DistBackend.DistributionCenterID = distCenterID
	}

	// Override frontend config with environment variables
	if userPath := os.Getenv("FRONTEND_USER_PATH"); userPath != "" {
		cfg.Frontend.User.Path = userPath
	}
	if userEnabled := os.Getenv("FRONTEND_USER_ENABLED"); userEnabled == "true" {
		cfg.Frontend.User.Enabled = true
	} else if userEnabled == "false" {
		cfg.Frontend.User.Enabled = false
	}
	if adminPath := os.Getenv("FRONTEND_ADMIN_PATH"); adminPath != "" {
		cfg.Frontend.Admin.Path = adminPath
	}
	if adminEnabled := os.Getenv("FRONTEND_ADMIN_ENABLED"); adminEnabled == "true" {
		cfg.Frontend.Admin.Enabled = true
	} else if adminEnabled == "false" {
		cfg.Frontend.Admin.Enabled = false
	}
	if adminPort := os.Getenv("FRONTEND_ADMIN_PORT"); adminPort != "" {
		port, err := strconv.Atoi(adminPort)
		if err != nil {
			return Config{}, errors.New("FRONTEND_ADMIN_PORT must be a valid integer")
		}
		cfg.Frontend.Admin.Port = port
	}

	// Container defaults: auto-enable known frontend paths if not explicitly configured.
	if cfg.Frontend.User.Path == "" && pathExists("/app/frontend/user/dist/index.html") {
		cfg.Frontend.User.Path = "/app/frontend/user/dist"
		cfg.Frontend.User.Enabled = true
	}
	if cfg.Frontend.Admin.Path == "" && pathExists("/app/frontend/orgadmin/dist/index.html") {
		cfg.Frontend.Admin.Path = "/app/frontend/orgadmin/dist"
		cfg.Frontend.Admin.Enabled = true
		if cfg.Frontend.Admin.Port == 0 {
			cfg.Frontend.Admin.Port = 8082
		}
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL missing")
	}
	if cfg.WorkOSAPIKey == "" {
		return Config{}, errors.New("WORKOS_API_KEY missing")
	}
	if cfg.WorkOSClientID == "" {
		return Config{}, errors.New("WORKOS_CLIENT_ID missing")
	}
	if cfg.JWTSecret == "" {
		return Config{}, errors.New("JWT_SECRET missing")
	}

	return cfg, nil
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
