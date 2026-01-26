package database_handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

// PostgreSQLDatabase implements Database interface using PostgreSQL
type PostgreSQLDatabase struct {
	db *sql.DB
}

// NewPostgreSQLDatabase creates a new PostgreSQL-based database
func NewPostgreSQLDatabase(config Config) (*PostgreSQLDatabase, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		config.Host, config.Port, config.User, config.Password, config.Database, config.SSLMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, &DatabaseError{
			Code:    ErrCodeConnection,
			Message: "failed to connect to PostgreSQL",
			Cause:   err,
		}
	}

	if err := db.Ping(); err != nil {
		return nil, &DatabaseError{
			Code:    ErrCodeConnection,
			Message: "failed to ping PostgreSQL",
			Cause:   err,
		}
	}

	pgdb := &PostgreSQLDatabase{db: db}

	// Create metadata table for storing schemas
	if err := pgdb.initMetadataTable(); err != nil {
		return nil, err
	}

	return pgdb, nil
}

// initMetadataTable creates the table for storing table schemas
func (db *PostgreSQLDatabase) initMetadataTable() error {
	query := `
		CREATE TABLE IF NOT EXISTS __table_schemas (
			table_name VARCHAR(255) PRIMARY KEY,
			schema_data JSONB NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		)
	`
	_, err := db.db.Exec(query)
	if err != nil {
		return NewIOError("failed to create metadata table", err)
	}
	return nil
}

// CreateTable creates a new table with schema
func (db *PostgreSQLDatabase) CreateTable(tableName string, schema TableSchema) error {
	// Check if table already exists
	exists, err := db.TableExists(tableName)
	if err != nil {
		return err
	}
	if exists {
		return &DatabaseError{
			Code:    ErrCodeAlreadyExists,
			Message: "table already exists: " + tableName,
		}
	}

	// Create table with JSONB column for flexible schema
	query := fmt.Sprintf(`
		CREATE TABLE %s (
			id VARCHAR(255) PRIMARY KEY,
			data JSONB NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		)
	`, tableName)

	if _, err := db.db.Exec(query); err != nil {
		return NewIOError("failed to create table", err)
	}

	// Save schema metadata
	schema.TableName = tableName
	schema.CreatedAt = time.Now()
	schema.UpdatedAt = time.Now()
	if schema.Version == 0 {
		schema.Version = 1
	}

	// Set addedInVersion for fields
	for i := range schema.Fields {
		if schema.Fields[i].AddedInVersion == 0 {
			schema.Fields[i].AddedInVersion = schema.Version
		}
	}

	return db.saveSchema(tableName, schema)
}

// DropTable removes a table
func (db *PostgreSQLDatabase) DropTable(tableName string) error {
	// Remove schema metadata
	_, err := db.db.Exec("DELETE FROM __table_schemas WHERE table_name = $1", tableName)
	if err != nil {
		return NewIOError("failed to delete schema metadata", err)
	}

	// Drop table
	query := fmt.Sprintf("DROP TABLE IF EXISTS %s", tableName)
	if _, err := db.db.Exec(query); err != nil {
		return NewIOError("failed to drop table", err)
	}

	return nil
}

// TableExists checks if a table exists
func (db *PostgreSQLDatabase) TableExists(tableName string) (bool, error) {
	var exists bool
	query := `
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_name = $1
		)
	`
	err := db.db.QueryRow(query, tableName).Scan(&exists)
	if err != nil {
		return false, NewIOError("failed to check table existence", err)
	}
	return exists, nil
}

// GetTableSchema retrieves the schema for a table
func (db *PostgreSQLDatabase) GetTableSchema(tableName string) (*TableSchema, error) {
	return db.loadSchema(tableName)
}

// UpdateTableSchema updates the schema for a table
func (db *PostgreSQLDatabase) UpdateTableSchema(tableName string, newSchema TableSchema) error {
	oldSchema, err := db.loadSchema(tableName)
	if err != nil {
		return err
	}

	// Merge fields
	mergedFields := MergeSchemaFields(oldSchema.Fields, newSchema.Fields)

	newSchema.Version = oldSchema.Version + 1
	newSchema.Fields = mergedFields
	newSchema.TableName = tableName
	newSchema.CreatedAt = oldSchema.CreatedAt
	newSchema.UpdatedAt = time.Now()

	// Mark new fields
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

// Insert adds a new record
func (db *PostgreSQLDatabase) Insert(tableName string, data map[string]interface{}) (string, error) {
	schema, err := db.loadSchema(tableName)
	if err != nil {
		return "", err
	}

	// Generate ID if not provided
	id, ok := data["id"].(string)
	if !ok || id == "" {
		return "", NewValidationError("id field is required")
	}

	// Apply defaults and validate
	data = ApplyDefaults(data, *schema)
	if err := ValidateData(data, *schema); err != nil {
		return "", err
	}

	// Check unique constraints
	if err := db.checkUniqueConstraints(tableName, data, schema.UniqueFields, ""); err != nil {
		return "", err
	}

	// Convert to JSON
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", NewIOError("failed to marshal data", err)
	}

	// Insert
	query := fmt.Sprintf(`
		INSERT INTO %s (id, data, created_at, updated_at)
		VALUES ($1, $2, $3, $4)
	`, tableName)

	now := time.Now()
	_, err = db.db.Exec(query, id, jsonData, now, now)
	if err != nil {
		return "", NewIOError("failed to insert record", err)
	}

	return id, nil
}

// Get retrieves a record by ID
func (db *PostgreSQLDatabase) Get(tableName string, id string) (map[string]interface{}, error) {
	schema, err := db.loadSchema(tableName)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf("SELECT data FROM %s WHERE id = $1", tableName)

	var jsonData []byte
	err = db.db.QueryRow(query, id).Scan(&jsonData)
	if err == sql.ErrNoRows {
		return nil, NewNotFoundError("record not found: " + id)
	}
	if err != nil {
		return nil, NewIOError("failed to query record", err)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(jsonData, &data); err != nil {
		return nil, NewIOError("failed to unmarshal data", err)
	}

	// Apply defaults for new fields
	data = ApplyDefaults(data, *schema)

	return data, nil
}

// Update modifies an existing record
func (db *PostgreSQLDatabase) Update(tableName string, id string, data map[string]interface{}) error {
	schema, err := db.loadSchema(tableName)
	if err != nil {
		return err
	}

	// Get existing data
	existing, err := db.Get(tableName, id)
	if err != nil {
		return err
	}

	// Merge
	for k, v := range data {
		existing[k] = v
	}
	existing["id"] = id

	// Apply defaults and validate
	existing = ApplyDefaults(existing, *schema)
	if err := ValidateData(existing, *schema); err != nil {
		return err
	}

	// Check unique constraints
	if err := db.checkUniqueConstraints(tableName, existing, schema.UniqueFields, id); err != nil {
		return err
	}

	// Convert to JSON
	jsonData, err := json.Marshal(existing)
	if err != nil {
		return NewIOError("failed to marshal data", err)
	}

	// Update
	query := fmt.Sprintf(`
		UPDATE %s
		SET data = $1, updated_at = $2
		WHERE id = $3
	`, tableName)

	result, err := db.db.Exec(query, jsonData, time.Now(), id)
	if err != nil {
		return NewIOError("failed to update record", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return NewNotFoundError("record not found: " + id)
	}

	return nil
}

// Delete removes a record
func (db *PostgreSQLDatabase) Delete(tableName string, id string) error {
	query := fmt.Sprintf("DELETE FROM %s WHERE id = $1", tableName)

	result, err := db.db.Exec(query, id)
	if err != nil {
		return NewIOError("failed to delete record", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return NewNotFoundError("record not found: " + id)
	}

	return nil
}

// List retrieves all records matching the filter
func (db *PostgreSQLDatabase) List(tableName string, filter map[string]interface{}) ([]map[string]interface{}, error) {
	schema, err := db.loadSchema(tableName)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf("SELECT data FROM %s", tableName)

	// Add WHERE clause for filters
	if len(filter) > 0 {
		conditions := []string{}
		args := []interface{}{}
		argCount := 1

		for key, value := range filter {
			jsonValue, _ := json.Marshal(value)
			conditions = append(conditions, fmt.Sprintf("data->>'%s' = $%d", key, argCount))
			args = append(args, string(jsonValue))
			argCount++
		}

		if len(conditions) > 0 {
			query += " WHERE " + conditions[0]
			for i := 1; i < len(conditions); i++ {
				query += " AND " + conditions[i]
			}
		}

		rows, err := db.db.Query(query, args...)
		if err != nil {
			return nil, NewIOError("failed to query records", err)
		}
		defer rows.Close()

		return db.scanRows(rows, schema)
	}

	rows, err := db.db.Query(query)
	if err != nil {
		return nil, NewIOError("failed to query records", err)
	}
	defer rows.Close()

	return db.scanRows(rows, schema)
}

// Close closes the database connection
func (db *PostgreSQLDatabase) Close() error {
	if db.db != nil {
		return db.db.Close()
	}
	return nil
}

// Helper methods

func (db *PostgreSQLDatabase) loadSchema(tableName string) (*TableSchema, error) {
	query := "SELECT schema_data FROM __table_schemas WHERE table_name = $1"

	var schemaJSON []byte
	err := db.db.QueryRow(query, tableName).Scan(&schemaJSON)
	if err == sql.ErrNoRows {
		return nil, NewNotFoundError("table does not exist: " + tableName)
	}
	if err != nil {
		return nil, NewIOError("failed to load schema", err)
	}

	var schema TableSchema
	if err := json.Unmarshal(schemaJSON, &schema); err != nil {
		return nil, NewIOError("failed to unmarshal schema", err)
	}

	return &schema, nil
}

func (db *PostgreSQLDatabase) saveSchema(tableName string, schema TableSchema) error {
	schemaJSON, err := json.Marshal(schema)
	if err != nil {
		return NewIOError("failed to marshal schema", err)
	}

	query := `
		INSERT INTO __table_schemas (table_name, schema_data, created_at, updated_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (table_name)
		DO UPDATE SET schema_data = $2, updated_at = $4
	`

	now := time.Now()
	_, err = db.db.Exec(query, tableName, schemaJSON, now, now)
	if err != nil {
		return NewIOError("failed to save schema", err)
	}

	return nil
}

func (db *PostgreSQLDatabase) checkUniqueConstraints(tableName string, data map[string]interface{}, uniqueFields []string, excludeID string) error {
	if len(uniqueFields) == 0 {
		return nil
	}

	for _, field := range uniqueFields {
		value, exists := data[field]
		if !exists {
			continue
		}

		valueJSON, _ := json.Marshal(value)
		query := fmt.Sprintf("SELECT id FROM %s WHERE data->>'%s' = $1", tableName, field)

		var existingID string
		err := db.db.QueryRow(query, string(valueJSON)).Scan(&existingID)

		if err == nil && existingID != excludeID {
			return &DatabaseError{
				Code:    ErrCodeValidation,
				Message: fmt.Sprintf("duplicate value for unique field '%s': %v", field, value),
			}
		}
	}

	return nil
}

func (db *PostgreSQLDatabase) scanRows(rows *sql.Rows, schema *TableSchema) ([]map[string]interface{}, error) {
	var results []map[string]interface{}

	for rows.Next() {
		var jsonData []byte
		if err := rows.Scan(&jsonData); err != nil {
			continue
		}

		var data map[string]interface{}
		if err := json.Unmarshal(jsonData, &data); err != nil {
			continue
		}

		// Apply defaults
		data = ApplyDefaults(data, *schema)
		results = append(results, data)
	}

	return results, nil
}
