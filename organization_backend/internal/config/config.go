package config

import (
	"errors"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Config struct {
	DatabaseURL string `yaml:"DATABASE_URL"`
}

func Load() (Config, error) {
	if url := os.Getenv("DATABASE_URL"); url != "" {
		return Config{DatabaseURL: url}, nil
	}

	path := os.Getenv("CONFIG_PATH")
	if path == "" {
		path = "config.yaml"
	}

	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return Config{}, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return Config{}, err
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL missing")
	}
	return cfg, nil
}
