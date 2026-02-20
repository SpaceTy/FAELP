package config

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

const defaultDatabaseURL = "postgresql://app_distributionbackend_dev:password@localhost:5432/distdb_dev?sslmode=disable"

type AdminConfig struct {
	Username string `yaml:"username"`
	Password string `yaml:"password"`
}

type OrgBackendConfig struct {
	URL        string `yaml:"url"`
	SocketPath string `yaml:"socket_path"`
	APIKey     string `yaml:"api_key"`
}

type InternalConfig struct {
	SocketPath    string `yaml:"socket_path"`
	SocketEnabled bool   `yaml:"socket_enabled"`
}

type FrontendConfig struct {
	Enabled bool   `yaml:"enabled"`
	Port    int    `yaml:"port"`
	Path    string `yaml:"path"`
}

type AdminFrontendConfig struct {
	Enabled bool   `yaml:"enabled"`
	Port    int    `yaml:"port"`
	Path    string `yaml:"path"`
}

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
	Frontend                  Frontend         `yaml:"frontend"`
}

func Load() (Config, error) {
	_ = godotenv.Load(".env")

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
	} else if !os.IsNotExist(err) {
		return Config{}, err
	}

	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL != "" && !strings.EqualFold(databaseURL, "replace-me") {
		cfg.DatabaseURL = databaseURL
	} else if builtURL, ok := buildDatabaseURLFromEnv(); ok {
		cfg.DatabaseURL = builtURL
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

	if orgURL := os.Getenv("ORG_BACKEND_URL"); orgURL != "" {
		cfg.OrgBackend.URL = orgURL
	}
	if socketPath := os.Getenv("ORG_BACKEND_SOCKET_PATH"); socketPath != "" {
		cfg.OrgBackend.SocketPath = socketPath
	}
	if apiKey := os.Getenv("ORG_BACKEND_API_KEY"); apiKey != "" {
		cfg.OrgBackend.APIKey = apiKey
	}

	if socketPath := os.Getenv("INTERNAL_SOCKET_PATH"); socketPath != "" {
		cfg.Internal.SocketPath = socketPath
	}
	if socketEnabled := os.Getenv("INTERNAL_SOCKET_ENABLED"); socketEnabled == "true" {
		cfg.Internal.SocketEnabled = true
	} else if socketEnabled == "false" {
		cfg.Internal.SocketEnabled = false
	}

	if dcID := os.Getenv("DISTRIBUTION_CENTER_ID"); dcID != "" {
		cfg.DistributionCenterID = dcID
	}

	if distPath := os.Getenv("FRONTEND_DISTRIBUTION_PATH"); distPath != "" {
		cfg.Frontend.Distribution.Path = distPath
	}
	if distEnabled := os.Getenv("FRONTEND_DISTRIBUTION_ENABLED"); distEnabled == "true" {
		cfg.Frontend.Distribution.Enabled = true
	} else if distEnabled == "false" {
		cfg.Frontend.Distribution.Enabled = false
	}
	if distPort := os.Getenv("FRONTEND_DISTRIBUTION_PORT"); distPort != "" {
		port, err := strconv.Atoi(distPort)
		if err != nil {
			return Config{}, errors.New("FRONTEND_DISTRIBUTION_PORT must be a valid integer")
		}
		cfg.Frontend.Distribution.Port = port
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

	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = defaultDatabaseURL
	}

	if cfg.OrgBackend.URL == "" && cfg.OrganizationBackendURL != "" {
		cfg.OrgBackend.URL = cfg.OrganizationBackendURL
	}
	if cfg.OrgBackend.APIKey == "" && cfg.OrganizationBackendAPIKey != "" {
		cfg.OrgBackend.APIKey = cfg.OrganizationBackendAPIKey
	}

	jwt := strings.TrimSpace(cfg.JWTSecret)
	if jwt == "" || strings.EqualFold(jwt, "replace-me") {
		generated, err := generateJWTSecret()
		if err != nil {
			return Config{}, fmt.Errorf("failed to generate JWT_SECRET: %w", err)
		}
		cfg.JWTSecret = generated
	}

	if cfg.Frontend.Distribution.Path == "" && pathExists("/app/frontend/distribution/dist/index.html") {
		cfg.Frontend.Distribution.Path = "/app/frontend/distribution/dist"
		cfg.Frontend.Distribution.Enabled = true
	}
	if cfg.Frontend.Distribution.Port == 0 {
		cfg.Frontend.Distribution.Port = 8081
	}
	if cfg.Frontend.Admin.Path == "" && pathExists("/app/frontend/distadmin/dist/index.html") {
		cfg.Frontend.Admin.Path = "/app/frontend/distadmin/dist"
		cfg.Frontend.Admin.Enabled = true
		if cfg.Frontend.Admin.Port == 0 {
			cfg.Frontend.Admin.Port = 8083
		}
	}

	return cfg, nil
}

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

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func generateJWTSecret() (string, error) {
	const keyBytes = 32
	buf := make([]byte, keyBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func buildDatabaseURLFromEnv() (string, bool) {
	host := strings.TrimSpace(os.Getenv("DB_HOST"))
	port := strings.TrimSpace(os.Getenv("DB_PORT"))
	name := strings.TrimSpace(os.Getenv("DB_NAME"))
	user := strings.TrimSpace(os.Getenv("DB_USER"))
	password := os.Getenv("DB_PASSWORD")
	sslMode := strings.TrimSpace(os.Getenv("DB_SSLMODE"))
	if sslMode == "" {
		sslMode = "disable"
	}

	if host == "" || port == "" || name == "" || user == "" || password == "" {
		return "", false
	}

	u := &url.URL{
		Scheme: "postgresql",
		User:   url.UserPassword(user, password),
		Host:   host + ":" + port,
		Path:   name,
	}
	q := u.Query()
	q.Set("sslmode", sslMode)
	u.RawQuery = q.Encode()
	return u.String(), true
}
