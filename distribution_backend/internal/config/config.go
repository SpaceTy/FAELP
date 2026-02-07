package config

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const defaultDatabaseURL = "postgresql://app_distributionbackend_dev:password@localhost:5432/distdb_dev?sslmode=disable"

type Config struct {
	DatabaseURL string `yaml:"DATABASE_URL"`
}

func Load() (Config, error) {
	var cfg Config

	// First check environment variable
	if url := os.Getenv("DATABASE_URL"); url != "" {
		cfg.DatabaseURL = url
		return cfg, nil
	}

	// Try to load from config.yaml
	path := os.Getenv("CONFIG_PATH")
	if path == "" {
		path = "config.yaml"
	}

	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		// Config file not found, use default
		cfg.DatabaseURL = defaultDatabaseURL
		return cfg, nil
	}

	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return Config{}, err
	}

	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = defaultDatabaseURL
	}

	return cfg, nil
}
