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

type Config struct {
	DatabaseURL string      `yaml:"DATABASE_URL"`
	JWTSecret   string      `yaml:"JWT_SECRET"`
	Admin       AdminConfig `yaml:"admin"`
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
	if adminUser := os.Getenv("ADMIN_USERNAME"); adminUser != "" {
		cfg.Admin.Username = adminUser
	}
	if adminPass := os.Getenv("ADMIN_PASSWORD"); adminPass != "" {
		cfg.Admin.Password = adminPass
	}

	// Apply defaults
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = defaultDatabaseURL
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
