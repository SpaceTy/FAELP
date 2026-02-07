package config

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

type Config struct {
	DatabaseURL                    string `yaml:"DATABASE_URL"`
	WorkOSAPIKey                   string
	WorkOSClientID                 string
	JWTSecret                      string
	InterbackendHibernateAfterMin  int `yaml:"INTERBACKEND_HIBERNATE_AFTER_MINUTES"`
	InterbackendAdminLockAfterHour int `yaml:"INTERBACKEND_ADMIN_LOCK_AFTER_HOURS"`
}

func Load() (Config, error) {
	_ = godotenv.Load(".env")

	cfg := Config{
		WorkOSAPIKey:   os.Getenv("WORKOS_API_KEY"),
		WorkOSClientID: os.Getenv("WORKOS_CLIENT_ID"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
	}

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

	if v := os.Getenv("INTERBACKEND_HIBERNATE_AFTER_MINUTES"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return Config{}, errors.New("INTERBACKEND_HIBERNATE_AFTER_MINUTES must be integer")
		}
		cfg.InterbackendHibernateAfterMin = n
	}
	if v := os.Getenv("INTERBACKEND_ADMIN_LOCK_AFTER_HOURS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return Config{}, errors.New("INTERBACKEND_ADMIN_LOCK_AFTER_HOURS must be integer")
		}
		cfg.InterbackendAdminLockAfterHour = n
	}

	if cfg.InterbackendHibernateAfterMin <= 0 {
		cfg.InterbackendHibernateAfterMin = 60
	}
	if cfg.InterbackendAdminLockAfterHour <= 0 {
		cfg.InterbackendAdminLockAfterHour = 72
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
