package config

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const defaultDatabaseURL = "postgresql://app_distributionbackend_dev:password@localhost:5432/distdb_dev?sslmode=disable"

// AdminConfig holds the initial admin account configuration
type AdminConfig struct {
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

// OrgBackendConfig holds configuration for connecting to organization backend
type OrgBackendConfig struct {
	URL        string `yaml:"url"`
	SocketPath string `yaml:"socket_path"`
	APIKey     string `yaml:"api_key"`
}

// InternalConfig holds Unix socket configuration for internal communication
type InternalConfig struct {
	SocketPath    string `yaml:"socket_path"`
	SocketEnabled bool   `yaml:"socket_enabled"`
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
	Distribution FrontendConfig      `yaml:"distribution"`
	Admin        AdminFrontendConfig `yaml:"admin"`
}

type Config struct {
	DatabaseURL               string           `yaml:"DATABASE_URL"`
	JWTSecret                 string           `yaml:"JWT_SECRET"`
	OrganizationBackendURL    string           `yaml:"ORGANIZATION_BACKEND_URL"`
	OrganizationBackendAPIKey string           `yaml:"ORGANIZATION_BACKEND_API_KEY"`
	Admin                     AdminConfig      `yaml:"admin"`
	OrgBackend                OrgBackendConfig `yaml:"organization_backend"`
	Internal                  InternalConfig   `yaml:"internal"`
	DistributionCenterID      string           `yaml:"distribution_center_id"`

	// Frontend serving configuration
	Frontend Frontend `yaml:"frontend"`
}

func Load() (Config, error) {
	var cfg Config

	// Try to load from config.yaml first to get all settings
	path := os.Getenv("CONFIG_PATH")
	if path == "" {
		path = "config.yaml"
	}

	data, err := os.ReadFile(filepath.Clean(path))
	if err == nil {
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return Config{}, err
		}
	}

	// Override with environment variables if set
	if url := os.Getenv("DATABASE_URL"); url != "" {
		cfg.DatabaseURL = url
	}
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		cfg.JWTSecret = secret
	}
	if orgURL := os.Getenv("ORGANIZATION_BACKEND_URL"); orgURL != "" {
		cfg.OrganizationBackendURL = orgURL
	}
	if orgAPIKey := os.Getenv("ORGANIZATION_BACKEND_API_KEY"); orgAPIKey != "" {
		cfg.OrganizationBackendAPIKey = orgAPIKey
	}
	if adminUser := os.Getenv("ADMIN_USERNAME"); adminUser != "" {
		cfg.Admin.Username = adminUser
	}
	if adminPass := os.Getenv("ADMIN_PASSWORD"); adminPass != "" {
		cfg.Admin.Password = adminPass
	}

	// Override organization backend config with environment variables
	if orgURL := os.Getenv("ORG_BACKEND_URL"); orgURL != "" {
		cfg.OrgBackend.URL = orgURL
	}
	if socketPath := os.Getenv("ORG_BACKEND_SOCKET_PATH"); socketPath != "" {
		cfg.OrgBackend.SocketPath = socketPath
	}
	if apiKey := os.Getenv("ORG_BACKEND_API_KEY"); apiKey != "" {
		cfg.OrgBackend.APIKey = apiKey
	}

	// Override internal socket config with environment variables
	if socketPath := os.Getenv("INTERNAL_SOCKET_PATH"); socketPath != "" {
		cfg.Internal.SocketPath = socketPath
	}
	if socketEnabled := os.Getenv("INTERNAL_SOCKET_ENABLED"); socketEnabled == "true" {
		cfg.Internal.SocketEnabled = true
	} else if socketEnabled == "false" {
		cfg.Internal.SocketEnabled = false
	}

	// Override distribution center ID with environment variable
	if dcID := os.Getenv("DISTRIBUTION_CENTER_ID"); dcID != "" {
		cfg.DistributionCenterID = dcID
	}

	// Apply defaults
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = defaultDatabaseURL
	}

	// Backwards compatibility: use old config if new org_backend not set
	if cfg.OrgBackend.URL == "" && cfg.OrganizationBackendURL != "" {
		cfg.OrgBackend.URL = cfg.OrganizationBackendURL
	}
	if cfg.OrgBackend.APIKey == "" && cfg.OrganizationBackendAPIKey != "" {
		cfg.OrgBackend.APIKey = cfg.OrganizationBackendAPIKey
	}

	// Generate a random JWT secret if not configured (for development only)
	if cfg.JWTSecret == "" {
		secret, err := generateRandomSecret(32)
		if err != nil {
			return Config{}, errors.New("JWT_SECRET not configured and failed to generate random secret")
		}
		cfg.JWTSecret = secret
	}

	return cfg, nil
}

// Validate checks if required configuration is present
func (c *Config) Validate() error {
	if c.Admin.Username == "" {
		return errors.New("admin username is required in config")
	}
	if c.Admin.Password == "" {
		return errors.New("admin password is required in config")
	}
	if len(c.Admin.Password) < 8 {
		return errors.New("admin password must be at least 8 characters")
	}
	if len(c.JWTSecret) < 16 {
		return errors.New("JWT_SECRET must be at least 16 characters")
	}
	return nil
}

func generateRandomSecret(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}
