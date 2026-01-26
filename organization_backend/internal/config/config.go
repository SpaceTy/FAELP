package config

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Config struct {
	DatabaseURL  string `yaml:"DATABASE_URL"`
	DatabaseMode string `yaml:"DATABASE_MODE"` // "json" or "postgresql"
	DataPath     string `yaml:"DATA_PATH"`     // For JSON mode
}

func Load() (Config, error) {
	// Check environment variables first
	cfg := Config{
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		DatabaseMode: os.Getenv("DATABASE_MODE"),
		DataPath:     os.Getenv("DATA_PATH"),
	}

	if cfg.DatabaseURL != "" && cfg.DatabaseMode != "" {
		return cfg, nil
	}

	// Load from config file
	path := os.Getenv("CONFIG_PATH")
	if path == "" {
		path = "config.yaml"
	}

	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		// If no config file and no env vars, use defaults
		if cfg.DatabaseMode == "" {
			cfg.DatabaseMode = "json"
		}
		if cfg.DataPath == "" {
			cfg.DataPath = "./data"
		}
		return cfg, nil
	}

	var fileCfg Config
	if err := yaml.Unmarshal(data, &fileCfg); err != nil {
		return Config{}, err
	}

	// Merge with environment variables (env takes precedence)
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = fileCfg.DatabaseURL
	}
	if cfg.DatabaseMode == "" {
		cfg.DatabaseMode = fileCfg.DatabaseMode
	}
	if cfg.DataPath == "" {
		cfg.DataPath = fileCfg.DataPath
	}

	// Set defaults
	if cfg.DatabaseMode == "" {
		cfg.DatabaseMode = "json"
	}
	if cfg.DataPath == "" {
		cfg.DataPath = "./data"
	}

	return cfg, nil
}
