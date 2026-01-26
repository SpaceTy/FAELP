package database_handler

import (
	"encoding/json"
	"time"
)

// DatabaseMode represents the storage backend type
type DatabaseMode string

const (
	ModeJSON       DatabaseMode = "json"
	ModePostgreSQL DatabaseMode = "postgresql"
)

// Database is the main interface for database operations
type Database interface {
	// Table operations
	CreateTable(tableName string, schema TableSchema) error
	DropTable(tableName string) error
	TableExists(tableName string) (bool, error)
	GetTableSchema(tableName string) (*TableSchema, error)
	UpdateTableSchema(tableName string, schema TableSchema) error

	// CRUD operations
	Insert(tableName string, data map[string]interface{}) (string, error)
	Get(tableName string, id string) (map[string]interface{}, error)
	Update(tableName string, id string, data map[string]interface{}) error
	Delete(tableName string, id string) error
	List(tableName string, filter map[string]interface{}) ([]map[string]interface{}, error)

	// Connection management
	Close() error
}

// TableSchema defines the structure and constraints of a table
type TableSchema struct {
	TableName    string            `json:"tableName"`
	Fields       []FieldDefinition `json:"fields"`
	UniqueFields []string          `json:"uniqueFields"`
	RequiredFields []string        `json:"requiredFields"`
	Version      int               `json:"version"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
}

// FieldDefinition describes a single field in the schema
type FieldDefinition struct {
	Name         string      `json:"name"`
	Type         string      `json:"type"` // "string", "number", "boolean", "date", "object", "array"
	DefaultValue interface{} `json:"defaultValue,omitempty"`
	Description  string      `json:"description,omitempty"`
	AddedInVersion int       `json:"addedInVersion"`
}

// Config holds database configuration
type Config struct {
	Mode           DatabaseMode

	// JSON mode config
	DataPath       string

	// PostgreSQL mode config
	Host           string
	Port           int
	Database       string
	User           string
	Password       string
	SSLMode        string
}

// NewDatabase creates a new database instance based on the configuration
func NewDatabase(config Config) (Database, error) {
	switch config.Mode {
	case ModeJSON, "":
		return NewJSONDatabase(config.DataPath)
	case ModePostgreSQL:
		return NewPostgreSQLDatabase(config)
	default:
		return nil, &DatabaseError{
			Code:    ErrCodeInvalidConfig,
			Message: "invalid database mode",
		}
	}
}

// MergeSchemaFields merges old and new field definitions for backward compatibility
func MergeSchemaFields(oldFields, newFields []FieldDefinition) []FieldDefinition {
	fieldMap := make(map[string]FieldDefinition)

	// Add all old fields
	for _, field := range oldFields {
		fieldMap[field.Name] = field
	}

	// Add or update with new fields
	for _, field := range newFields {
		fieldMap[field.Name] = field
	}

	// Convert back to slice
	merged := make([]FieldDefinition, 0, len(fieldMap))
	for _, field := range fieldMap {
		merged = append(merged, field)
	}

	return merged
}

// ApplyDefaults applies default values to data based on schema
func ApplyDefaults(data map[string]interface{}, schema TableSchema) map[string]interface{} {
	result := make(map[string]interface{})

	// Copy existing data
	for k, v := range data {
		result[k] = v
	}

	// Apply defaults for missing fields
	for _, field := range schema.Fields {
		if _, exists := result[field.Name]; !exists && field.DefaultValue != nil {
			result[field.Name] = field.DefaultValue
		}
	}

	return result
}

// ValidateData validates data against schema
func ValidateData(data map[string]interface{}, schema TableSchema) error {
	// Check required fields
	for _, fieldName := range schema.RequiredFields {
		if _, exists := data[fieldName]; !exists {
			return &DatabaseError{
				Code:    ErrCodeValidation,
				Message: "missing required field: " + fieldName,
			}
		}
	}

	// Check field types
	fieldTypes := make(map[string]string)
	for _, field := range schema.Fields {
		fieldTypes[field.Name] = field.Type
	}

	for key, value := range data {
		expectedType, exists := fieldTypes[key]
		if !exists {
			// Allow unknown fields for backward compatibility
			continue
		}

		if !validateType(value, expectedType) {
			return &DatabaseError{
				Code:    ErrCodeValidation,
				Message: "invalid type for field " + key + ": expected " + expectedType,
			}
		}
	}

	return nil
}

func validateType(value interface{}, expectedType string) bool {
	if value == nil {
		return true
	}

	switch expectedType {
	case "string":
		_, ok := value.(string)
		return ok
	case "number":
		switch value.(type) {
		case float64, int, int64, float32:
			return true
		default:
			return false
		}
	case "boolean":
		_, ok := value.(bool)
		return ok
	case "date":
		_, ok := value.(time.Time)
		if ok {
			return true
		}
		_, ok = value.(string)
		return ok
	case "object":
		_, ok := value.(map[string]interface{})
		return ok
	case "array":
		switch value.(type) {
		case []interface{}, []string, []int, []float64:
			return true
		default:
			return false
		}
	default:
		return true
	}
}

// Helper function to convert interface to JSON and back for deep copying
func DeepCopy(src interface{}) (interface{}, error) {
	data, err := json.Marshal(src)
	if err != nil {
		return nil, err
	}

	var result interface{}
	err = json.Unmarshal(data, &result)
	return result, err
}
