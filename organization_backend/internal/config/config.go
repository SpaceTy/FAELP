package config

import (
	"errors"
	"os"
	"path/filepath"

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

	// Load WorkOS and JWT from environment (or .env file)
	cfg := Config{
		WorkOSAPIKey:   os.Getenv("WORKOS_API_KEY"),
		WorkOSClientID: os.Getenv("WORKOS_CLIENT_ID"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
	}

	// Load DATABASE_URL from environment or config file
	if url := os.Getenv("DATABASE_URL"); url != "" {
		cfg.DatabaseURL = url
	} else {
		path := os.Getenv("CONFIG_PATH")
		if path == "" {
			path = "config.yaml"
		}

		data, err := os.ReadFile(filepath.Clean(path))
		if err != nil {
			return Config{}, err
		}

		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return Config{}, err
		}
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
