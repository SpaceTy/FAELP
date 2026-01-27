package config

import (
	"errors"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

type Config struct {
	DatabaseURL    string `yaml:"DATABASE_URL"`
	WorkOSAPIKey   string
	WorkOSClientID string
	JWTSecret      string
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
