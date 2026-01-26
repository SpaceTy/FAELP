package database_handler

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

// JSONDatabase implements Database interface using JSON files
type JSONDatabase struct {
	basePath string
	mu       sync.RWMutex
}

// NewJSONDatabase creates a new JSON-based database
func NewJSONDatabase(basePath string) (*JSONDatabase, error) {
	if basePath == "" {
		basePath = "./data"
	}

	// Create base directory if it doesn't exist
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, NewIOError("failed to create data directory", err)
	}

	return &JSONDatabase{
		basePath: basePath,
	}, nil
}

// CreateTable creates a new table (folder) with schema
func (db *JSONDatabase) CreateTable(tableName string, schema TableSchema) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	tablePath := filepath.Join(db.basePath, tableName)

	// Check if table already exists
	if _, err := os.Stat(tablePath); err == nil {
		return &DatabaseError{
			Code:    ErrCodeAlreadyExists,
			Message: "table already exists: " + tableName,
		}
	}

	// Create table directory
	if err := os.MkdirAll(tablePath, 0755); err != nil {
		return NewIOError("failed to create table directory", err)
	}

	// Set schema metadata
	schema.TableName = tableName
	schema.CreatedAt = time.Now()
	schema.UpdatedAt = time.Now()
	if schema.Version == 0 {
		schema.Version = 1
	}

	// Set addedInVersion for fields if not set
	for i := range schema.Fields {
		if schema.Fields[i].AddedInVersion == 0 {
			schema.Fields[i].AddedInVersion = schema.Version
		}
	}

	// Save schema as index.json
	return db.saveSchema(tableName, schema)
}

// DropTable removes a table and all its data
func (db *JSONDatabase) DropTable(tableName string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	tablePath := filepath.Join(db.basePath, tableName)

	if _, err := os.Stat(tablePath); os.IsNotExist(err) {
		return NewNotFoundError("table does not exist: " + tableName)
	}

	if err := os.RemoveAll(tablePath); err != nil {
		return NewIOError("failed to remove table directory", err)
	}

	return nil
}

// TableExists checks if a table exists
func (db *JSONDatabase) TableExists(tableName string) (bool, error) {
	tablePath := filepath.Join(db.basePath, tableName)
	_, err := os.Stat(tablePath)

	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, NewIOError("failed to check table existence", err)
	}

	return true, nil
}

// GetTableSchema retrieves the schema for a table
func (db *JSONDatabase) GetTableSchema(tableName string) (*TableSchema, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	return db.loadSchema(tableName)
}

// UpdateTableSchema updates the schema for a table
func (db *JSONDatabase) UpdateTableSchema(tableName string, newSchema TableSchema) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	// Load existing schema
	oldSchema, err := db.loadSchema(tableName)
	if err != nil {
		return err
	}

	// Merge fields for backward compatibility
	mergedFields := MergeSchemaFields(oldSchema.Fields, newSchema.Fields)

	// Update version
	newSchema.Version = oldSchema.Version + 1
	newSchema.Fields = mergedFields
	newSchema.TableName = tableName
	newSchema.CreatedAt = oldSchema.CreatedAt
	newSchema.UpdatedAt = time.Now()

	// Mark new fields with current version
	oldFieldNames := make(map[string]bool)
	for _, field := range oldSchema.Fields {
		oldFieldNames[field.Name] = true
	}

	for i := range newSchema.Fields {
		if !oldFieldNames[newSchema.Fields[i].Name] {
			newSchema.Fields[i].AddedInVersion = newSchema.Version
		}
	}

	return db.saveSchema(tableName, newSchema)
}

// Insert adds a new record to the table
func (db *JSONDatabase) Insert(tableName string, data map[string]interface{}) (string, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	schema, err := db.loadSchema(tableName)
	if err != nil {
		return "", err
	}

	// Generate ID if not provided
	id, ok := data["id"].(string)
	if !ok || id == "" {
		id = uuid.New().String()
		data["id"] = id
	}

	// Apply default values
	data = ApplyDefaults(data, *schema)

	// Validate data
	if err := ValidateData(data, *schema); err != nil {
		return "", err
	}

	// Check unique constraints
	if err := db.checkUniqueConstraints(tableName, data, schema.UniqueFields, ""); err != nil {
		return "", err
	}

	// Add timestamps
	now := time.Now()
	if _, exists := data["createdAt"]; !exists {
		data["createdAt"] = now
	}
	data["updatedAt"] = now

	// Save to file
	filePath := filepath.Join(db.basePath, tableName, id+".json")
	if err := db.saveJSON(filePath, data); err != nil {
		return "", err
	}

	return id, nil
}

// Get retrieves a record by ID
func (db *JSONDatabase) Get(tableName string, id string) (map[string]interface{}, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	schema, err := db.loadSchema(tableName)
	if err != nil {
		return nil, err
	}

	filePath := filepath.Join(db.basePath, tableName, id+".json")
	data, err := db.loadJSON(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, NewNotFoundError("record not found: " + id)
		}
		return nil, err
	}

	// Apply defaults for fields added after this record was created
	data = ApplyDefaults(data, *schema)

	return data, nil
}

// Update modifies an existing record
func (db *JSONDatabase) Update(tableName string, id string, data map[string]interface{}) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	schema, err := db.loadSchema(tableName)
	if err != nil {
		return err
	}

	// Load existing data
	filePath := filepath.Join(db.basePath, tableName, id+".json")
	existing, err := db.loadJSON(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return NewNotFoundError("record not found: " + id)
		}
		return err
	}

	// Merge with existing data
	for k, v := range data {
		existing[k] = v
	}
	existing["id"] = id
	existing["updatedAt"] = time.Now()

	// Apply defaults
	existing = ApplyDefaults(existing, *schema)

	// Validate
	if err := ValidateData(existing, *schema); err != nil {
		return err
	}

	// Check unique constraints
	if err := db.checkUniqueConstraints(tableName, existing, schema.UniqueFields, id); err != nil {
		return err
	}

	// Save
	return db.saveJSON(filePath, existing)
}

// Delete removes a record
func (db *JSONDatabase) Delete(tableName string, id string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	filePath := filepath.Join(db.basePath, tableName, id+".json")

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return NewNotFoundError("record not found: " + id)
	}

	if err := os.Remove(filePath); err != nil {
		return NewIOError("failed to delete record", err)
	}

	return nil
}

// List retrieves all records matching the filter
func (db *JSONDatabase) List(tableName string, filter map[string]interface{}) ([]map[string]interface{}, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	schema, err := db.loadSchema(tableName)
	if err != nil {
		return nil, err
	}

	tablePath := filepath.Join(db.basePath, tableName)
	entries, err := os.ReadDir(tablePath)
	if err != nil {
		return nil, NewIOError("failed to read table directory", err)
	}

	var results []map[string]interface{}

	for _, entry := range entries {
		if entry.IsDir() || entry.Name() == "index.json" {
			continue
		}

		filePath := filepath.Join(tablePath, entry.Name())
		data, err := db.loadJSON(filePath)
		if err != nil {
			continue
		}

		// Apply defaults
		data = ApplyDefaults(data, *schema)

		// Apply filter
		if matchesFilter(data, filter) {
			results = append(results, data)
		}
	}

	return results, nil
}

// Close closes the database (no-op for JSON backend)
func (db *JSONDatabase) Close() error {
	return nil
}

// Helper methods

func (db *JSONDatabase) loadSchema(tableName string) (*TableSchema, error) {
	schemaPath := filepath.Join(db.basePath, tableName, "index.json")

	data, err := os.ReadFile(schemaPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, NewNotFoundError("table does not exist: " + tableName)
		}
		return nil, NewIOError("failed to read schema", err)
	}

	var schema TableSchema
	if err := json.Unmarshal(data, &schema); err != nil {
		return nil, NewIOError("failed to parse schema", err)
	}

	return &schema, nil
}

func (db *JSONDatabase) saveSchema(tableName string, schema TableSchema) error {
	schemaPath := filepath.Join(db.basePath, tableName, "index.json")
	return db.saveJSON(schemaPath, schema)
}

func (db *JSONDatabase) loadJSON(filePath string) (map[string]interface{}, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, NewIOError("failed to parse JSON", err)
	}

	return result, nil
}

func (db *JSONDatabase) saveJSON(filePath string, data interface{}) error {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return NewIOError("failed to marshal JSON", err)
	}

	if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
		return NewIOError("failed to write file", err)
	}

	return nil
}

func (db *JSONDatabase) checkUniqueConstraints(tableName string, data map[string]interface{}, uniqueFields []string, excludeID string) error {
	if len(uniqueFields) == 0 {
		return nil
	}

	tablePath := filepath.Join(db.basePath, tableName)
	entries, err := os.ReadDir(tablePath)
	if err != nil {
		return NewIOError("failed to read table directory", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || entry.Name() == "index.json" {
			continue
		}

		// Skip the record being updated
		recordID := entry.Name()[:len(entry.Name())-5] // Remove .json
		if recordID == excludeID {
			continue
		}

		filePath := filepath.Join(tablePath, entry.Name())
		existing, err := db.loadJSON(filePath)
		if err != nil {
			continue
		}

		// Check each unique field
		for _, field := range uniqueFields {
			dataVal, dataExists := data[field]
			existingVal, existingExists := existing[field]

			if dataExists && existingExists && dataVal == existingVal {
				return &DatabaseError{
					Code:    ErrCodeValidation,
					Message: fmt.Sprintf("duplicate value for unique field '%s': %v", field, dataVal),
				}
			}
		}
	}

	return nil
}

func matchesFilter(data map[string]interface{}, filter map[string]interface{}) bool {
	if len(filter) == 0 {
		return true
	}

	for key, value := range filter {
		dataValue, exists := data[key]
		if !exists || dataValue != value {
			return false
		}
	}

	return true
}
