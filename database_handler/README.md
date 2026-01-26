# Database Handler Middleware

A flexible Go database middleware that provides seamless switching between JSON file storage and PostgreSQL. Designed for projects where the database choice isn't finalized yet.

## Features

- **Dual Backend Support**: Switch between JSON files and PostgreSQL without changing application code
- **Schema Management**: Define table schemas with field types, unique constraints, and required fields
- **Backward Compatibility**: Automatically handles schema evolution - old records work with new schemas
- **Default JSON Mode**: Uses JSON file storage by default for quick development
- **Type Safety**: Validates data against defined schemas
- **Simple API**: Consistent interface regardless of backend

## Installation

```bash
go get github.com/yourusername/database_handler
```

## Quick Start

```go
package main

import (
    "fmt"
    "log"
    db "github.com/yourusername/database_handler"
)

func main() {
    // Create database (JSON mode by default)
    database, err := db.NewDatabase(db.Config{
        Mode:     db.ModeJSON,
        DataPath: "./data",
    })
    if err != nil {
        log.Fatal(err)
    }
    defer database.Close()

    // Define schema
    schema := db.TableSchema{
        Fields: []db.FieldDefinition{
            {Name: "id", Type: "string"},
            {Name: "email", Type: "string"},
            {Name: "name", Type: "string"},
        },
        UniqueFields:   []string{"email"},
        RequiredFields: []string{"email", "name"},
    }

    // Create table
    database.CreateTable("customers", schema)

    // Insert data
    customer := map[string]interface{}{
        "id":    "cust-001",
        "email": "user@example.com",
        "name":  "John Doe",
    }
    id, _ := database.Insert("customers", customer)
    fmt.Println("Inserted:", id)

    // Retrieve data
    result, _ := database.Get("customers", id)
    fmt.Println("Retrieved:", result)
}
```

## Configuration

### JSON Mode (Default)

```go
db, err := db.NewDatabase(db.Config{
    Mode:     db.ModeJSON,
    DataPath: "./data", // Directory for JSON files
})
```

**Storage Structure:**
```
data/
├── customers/
│   ├── index.json          # Table schema
│   ├── cust-001.json       # Individual records
│   └── cust-002.json
└── requests/
    ├── index.json
    └── req-001.json
```

### PostgreSQL Mode

```go
db, err := db.NewDatabase(db.Config{
    Mode:     db.ModePostgreSQL,
    Host:     "localhost",
    Port:     5432,
    Database: "myapp",
    User:     "postgres",
    Password: "password",
    SSLMode:  "disable",
})
```

## API Reference

### Database Operations

#### CreateTable
```go
schema := db.TableSchema{
    Fields: []db.FieldDefinition{
        {Name: "id", Type: "string"},
        {Name: "email", Type: "string"},
        {Name: "status", Type: "string", DefaultValue: "active"},
    },
    UniqueFields:   []string{"email"},
    RequiredFields: []string{"email"},
}
err := database.CreateTable("users", schema)
```

#### Insert
```go
data := map[string]interface{}{
    "id":    "user-123",
    "email": "user@example.com",
}
id, err := database.Insert("users", data)
```

#### Get
```go
record, err := database.Get("users", "user-123")
```

#### Update
```go
updates := map[string]interface{}{
    "status": "inactive",
}
err := database.Update("users", "user-123", updates)
```

#### Delete
```go
err := database.Delete("users", "user-123")
```

#### List
```go
// Get all records
all, err := database.List("users", nil)

// Filter records
active, err := database.List("users", map[string]interface{}{
    "status": "active",
})
```

#### UpdateTableSchema
```go
// Add new field to existing schema
newSchema := schema
newSchema.Fields = append(newSchema.Fields, db.FieldDefinition{
    Name:         "phoneNumber",
    Type:         "string",
    DefaultValue: "",
})
err := database.UpdateTableSchema("users", newSchema)
```

## Schema Evolution & Backward Compatibility

The middleware automatically handles schema changes:

```go
// Original schema
schema := db.TableSchema{
    Fields: []db.FieldDefinition{
        {Name: "id", Type: "string"},
        {Name: "name", Type: "string"},
    },
}
database.CreateTable("customers", schema)

// Insert old record
database.Insert("customers", map[string]interface{}{
    "id":   "cust-001",
    "name": "John Doe",
})

// Update schema - add new field
schema.Fields = append(schema.Fields, db.FieldDefinition{
    Name:         "email",
    Type:         "string",
    DefaultValue: "no-email@example.com",
})
database.UpdateTableSchema("customers", schema)

// Old record automatically gets new field with default value
record, _ := database.Get("customers", "cust-001")
// record["email"] = "no-email@example.com"
```

## Field Types

Supported field types:
- `string`
- `number` (int, float64)
- `boolean`
- `date` (time.Time or string)
- `object` (map[string]interface{})
- `array` ([]interface{})

## Example: Request Management System

Based on the data structure from your project:

```go
// Create customer table
customerSchema := db.TableSchema{
    Fields: []db.FieldDefinition{
        {Name: "id", Type: "string"},
        {Name: "email", Type: "string"},
        {Name: "name", Type: "string"},
        {Name: "token", Type: "string"},
        {Name: "createdAt", Type: "date"},
    },
    UniqueFields:   []string{"email"},
    RequiredFields: []string{"email", "name"},
}
database.CreateTable("customers", customerSchema)

// Create request table
requestSchema := db.TableSchema{
    Fields: []db.FieldDefinition{
        {Name: "id", Type: "string"},
        {Name: "customer", Type: "object"},
        {Name: "items", Type: "object"},
        {Name: "deliveryDate", Type: "date"},
        {Name: "status", Type: "string"},
        {Name: "shippingAddress", Type: "object"},
        {Name: "createdAt", Type: "date"},
        {Name: "updatedAt", Type: "date"},
    },
    RequiredFields: []string{"customer", "items", "status"},
}
database.CreateTable("requests", requestSchema)

// Insert request
request := map[string]interface{}{
    "id": "req-001",
    "customer": map[string]interface{}{
        "id":    "cust-001",
        "email": "customer@example.com",
        "name":  "John Doe",
    },
    "items": map[string]interface{}{
        "manikin-adult-001": 5,
    },
    "deliveryDate": time.Now().Add(7 * 24 * time.Hour),
    "status":       "pending",
    "shippingAddress": map[string]interface{}{
        "customerName": "John Doe",
        "addressLine1": "123 Main St",
        "city":         "Berlin",
        "zipCode":      "10115",
    },
}
database.Insert("requests", request)

// List pending requests
pending, _ := database.List("requests", map[string]interface{}{
    "status": "pending",
})
```

## Running Tests

```bash
go test -v
```

## Error Handling

The middleware provides typed errors:

```go
_, err := database.Get("users", "nonexistent")
if dbErr, ok := err.(*db.DatabaseError); ok {
    switch dbErr.Code {
    case db.ErrCodeNotFound:
        // Handle not found
    case db.ErrCodeValidation:
        // Handle validation error
    case db.ErrCodeIO:
        // Handle IO error
    }
}
```

## Switching Backends

To switch from JSON to PostgreSQL:

1. Set up your PostgreSQL database
2. Change the configuration:

```go
// From:
db.NewDatabase(db.Config{Mode: db.ModeJSON, DataPath: "./data"})

// To:
db.NewDatabase(db.Config{
    Mode:     db.ModePostgreSQL,
    Host:     "localhost",
    Port:     5432,
    Database: "myapp",
    User:     "postgres",
    Password: "password",
    SSLMode:  "disable",
})
```

That's it! No other code changes needed.

## License

MIT
