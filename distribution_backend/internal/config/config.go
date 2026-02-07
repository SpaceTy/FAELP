package config

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"strconv"

	"gopkg.in/yaml.v3"
)

const defaultDatabaseURL = "postgresql://app_distributionbackend_dev:password@localhost:5432/distdb_dev?sslmode=disable"

// AdminConfig holds the initial admin account configuration
type AdminConfig struct {
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

type Config struct {
	DatabaseURL                      string      `yaml:"DATABASE_URL"`
	JWTSecret                        string      `yaml:"JWT_SECRET"`
	Admin                            AdminConfig `yaml:"admin"`
	OrgBaseURL                       string      `yaml:"ORG_BASE_URL"`
	OrgJWTSecret                     string      `yaml:"ORG_JWT_SECRET"`
	CenterCode                       string      `yaml:"CENTER_CODE"`
	CenterName                       string      `yaml:"CENTER_NAME"`
	CenterAddress                    string      `yaml:"CENTER_ADDRESS"`
	CallbackURL                      string      `yaml:"CALLBACK_URL"`
	InterbackendHeartbeatIntervalSec int         `yaml:"INTERBACKEND_HEARTBEAT_INTERVAL_SECONDS"`
	InterbackendInventoryIntervalSec int         `yaml:"INTERBACKEND_INVENTORY_PUSH_INTERVAL_SECONDS"`
	InterbackendTokenRefreshSkewSec  int         `yaml:"INTERBACKEND_TOKEN_REFRESH_SKEW_SECONDS"`
}

func Load() (Config, error) {
	var cfg Config

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
	if v := os.Getenv("ORG_BASE_URL"); v != "" {
		cfg.OrgBaseURL = v
	}
	if v := os.Getenv("ORG_JWT_SECRET"); v != "" {
		cfg.OrgJWTSecret = v
	}
	if v := os.Getenv("CENTER_CODE"); v != "" {
		cfg.CenterCode = v
	}
	if v := os.Getenv("CENTER_NAME"); v != "" {
		cfg.CenterName = v
	}
	if v := os.Getenv("CENTER_ADDRESS"); v != "" {
		cfg.CenterAddress = v
	}
	if v := os.Getenv("CALLBACK_URL"); v != "" {
		cfg.CallbackURL = v
	}
	if v := os.Getenv("INTERBACKEND_HEARTBEAT_INTERVAL_SECONDS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return Config{}, errors.New("INTERBACKEND_HEARTBEAT_INTERVAL_SECONDS must be integer")
		}
		cfg.InterbackendHeartbeatIntervalSec = n
	}
	if v := os.Getenv("INTERBACKEND_INVENTORY_PUSH_INTERVAL_SECONDS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return Config{}, errors.New("INTERBACKEND_INVENTORY_PUSH_INTERVAL_SECONDS must be integer")
		}
		cfg.InterbackendInventoryIntervalSec = n
	}
	if v := os.Getenv("INTERBACKEND_TOKEN_REFRESH_SKEW_SECONDS"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return Config{}, errors.New("INTERBACKEND_TOKEN_REFRESH_SKEW_SECONDS must be integer")
		}
		cfg.InterbackendTokenRefreshSkewSec = n
	}

	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = defaultDatabaseURL
	}

	if cfg.JWTSecret == "" {
		secret, err := generateRandomSecret(32)
		if err != nil {
			return Config{}, errors.New("JWT_SECRET not configured and failed to generate random secret")
		}
		cfg.JWTSecret = secret
	}

	if cfg.InterbackendHeartbeatIntervalSec <= 0 {
		cfg.InterbackendHeartbeatIntervalSec = 60
	}
	if cfg.InterbackendInventoryIntervalSec <= 0 {
		cfg.InterbackendInventoryIntervalSec = 300
	}
	if cfg.InterbackendTokenRefreshSkewSec <= 0 {
		cfg.InterbackendTokenRefreshSkewSec = 120
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
	if c.OrgBaseURL == "" {
		return errors.New("ORG_BASE_URL is required")
	}
	if c.CenterCode == "" || c.CenterName == "" || c.CenterAddress == "" || c.CallbackURL == "" {
		return errors.New("CENTER_CODE, CENTER_NAME, CENTER_ADDRESS and CALLBACK_URL are required")
	}
	if c.OrgJWTSecret == "" {
		return errors.New("ORG_JWT_SECRET is required")
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
