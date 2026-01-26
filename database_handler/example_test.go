package database_handler

import (
	"fmt"
	"log"
	"os"
	"testing"
	"time"
)

func TestJSONDatabase(t *testing.T) {
	// Clean up test data
	defer os.RemoveAll("./test_data")

	// Create database
	db, err := NewDatabase(Config{
		Mode:     ModeJSON,
		DataPath: "./test_data",
	})
	if err != nil {
		t.Fatalf("Failed to create database: %v", err)
	}
	defer db.Close()

	// Create customer table
	customerSchema := TableSchema{
		Fields: []FieldDefinition{
			{Name: "id", Type: "string"},
			{Name: "email", Type: "string"},
			{Name: "name", Type: "string"},
			{Name: "token", Type: "string"},
			{Name: "createdAt", Type: "date"},
		},
		UniqueFields:   []string{"email"},
		RequiredFields: []string{"email", "name"},
	}

	err = db.CreateTable("customers", customerSchema)
	if err != nil {
		t.Fatalf("Failed to create table: %v", err)
	}

	// Insert customer
	customer := map[string]interface{}{
		"id":    "cust-001",
		"email": "test@example.com",
		"name":  "Test Customer",
		"token": "secret-token-123",
	}

	id, err := db.Insert("customers", customer)
	if err != nil {
		t.Fatalf("Failed to insert customer: %v", err)
	}
	fmt.Printf("Inserted customer with ID: %s\n", id)

	// Get customer
	retrieved, err := db.Get("customers", id)
	if err != nil {
		t.Fatalf("Failed to get customer: %v", err)
	}
	fmt.Printf("Retrieved customer: %v\n", retrieved)

	// Update schema - add new field
	updatedSchema := customerSchema
	updatedSchema.Fields = append(updatedSchema.Fields, FieldDefinition{
		Name:         "phoneNumber",
		Type:         "string",
		DefaultValue: "",
	})

	err = db.UpdateTableSchema("customers", updatedSchema)
	if err != nil {
		t.Fatalf("Failed to update schema: %v", err)
	}

	// Get customer again - should have new field with default value
	retrieved, err = db.Get("customers", id)
	if err != nil {
		t.Fatalf("Failed to get customer after schema update: %v", err)
	}
	fmt.Printf("Customer after schema update: %v\n", retrieved)

	if _, exists := retrieved["phoneNumber"]; !exists {
		t.Error("Expected phoneNumber field to exist with default value")
	}

	// Insert new customer with phone number
	newCustomer := map[string]interface{}{
		"id":          "cust-002",
		"email":       "new@example.com",
		"name":        "New Customer",
		"token":       "token-456",
		"phoneNumber": "+1234567890",
	}

	_, err = db.Insert("customers", newCustomer)
	if err != nil {
		t.Fatalf("Failed to insert new customer: %v", err)
	}

	// List all customers
	customers, err := db.List("customers", nil)
	if err != nil {
		t.Fatalf("Failed to list customers: %v", err)
	}
	fmt.Printf("All customers: %v\n", customers)

	if len(customers) != 2 {
		t.Errorf("Expected 2 customers, got %d", len(customers))
	}

	// Test unique constraint
	duplicateCustomer := map[string]interface{}{
		"id":    "cust-003",
		"email": "test@example.com", // Duplicate email
		"name":  "Duplicate",
		"token": "token-789",
	}

	_, err = db.Insert("customers", duplicateCustomer)
	if err == nil {
		t.Error("Expected error for duplicate email, got nil")
	}
	fmt.Printf("Expected error for duplicate: %v\n", err)

	// Update customer
	err = db.Update("customers", id, map[string]interface{}{
		"name":        "Updated Name",
		"phoneNumber": "+9876543210",
	})
	if err != nil {
		t.Fatalf("Failed to update customer: %v", err)
	}

	updated, err := db.Get("customers", id)
	if err != nil {
		t.Fatalf("Failed to get updated customer: %v", err)
	}

	if updated["name"] != "Updated Name" {
		t.Errorf("Expected name to be 'Updated Name', got %v", updated["name"])
	}

	// Delete customer
	err = db.Delete("customers", "cust-002")
	if err != nil {
		t.Fatalf("Failed to delete customer: %v", err)
	}

	customers, err = db.List("customers", nil)
	if err != nil {
		t.Fatalf("Failed to list customers after delete: %v", err)
	}

	if len(customers) != 1 {
		t.Errorf("Expected 1 customer after delete, got %d", len(customers))
	}
}

func TestRequestTable(t *testing.T) {
	defer os.RemoveAll("./test_data_requests")

	db, err := NewDatabase(Config{
		Mode:     ModeJSON,
		DataPath: "./test_data_requests",
	})
	if err != nil {
		t.Fatalf("Failed to create database: %v", err)
	}
	defer db.Close()

	// Create request table based on datastructureplan.md
	requestSchema := TableSchema{
		Fields: []FieldDefinition{
			{Name: "id", Type: "string"},
			{Name: "customer", Type: "object"},
			{Name: "items", Type: "object"},
			{Name: "deliveryDate", Type: "date"},
			{Name: "status", Type: "string"},
			{Name: "shippingAddress", Type: "object"},
			{Name: "createdAt", Type: "date"},
			{Name: "updatedAt", Type: "date"},
		},
		RequiredFields: []string{"customer", "items", "deliveryDate", "status", "shippingAddress"},
	}

	err = db.CreateTable("requests", requestSchema)
	if err != nil {
		t.Fatalf("Failed to create requests table: %v", err)
	}

	// Insert a request
	request := map[string]interface{}{
		"id": "req-001",
		"customer": map[string]interface{}{
			"id":    "cust-001",
			"email": "customer@example.com",
			"name":  "John Doe",
		},
		"items": map[string]interface{}{
			"manikin-adult-001": 5,
			"manikin-child-001": 3,
		},
		"deliveryDate": time.Now().Add(7 * 24 * time.Hour),
		"status":       "pending",
		"shippingAddress": map[string]interface{}{
			"customerName": "John Doe",
			"addressLine1": "123 Main St",
			"addressLine2": nil,
			"city":         "Berlin",
			"zipCode":      "10115",
		},
	}

	id, err := db.Insert("requests", request)
	if err != nil {
		t.Fatalf("Failed to insert request: %v", err)
	}
	fmt.Printf("Inserted request with ID: %s\n", id)

	// Retrieve request
	retrieved, err := db.Get("requests", id)
	if err != nil {
		t.Fatalf("Failed to get request: %v", err)
	}
	fmt.Printf("Retrieved request: %v\n", retrieved)

	// Update request status
	err = db.Update("requests", id, map[string]interface{}{
		"status": "inAction",
	})
	if err != nil {
		t.Fatalf("Failed to update request: %v", err)
	}

	// List pending requests
	requests, err := db.List("requests", map[string]interface{}{
		"status": "inAction",
	})
	if err != nil {
		t.Fatalf("Failed to list requests: %v", err)
	}

	if len(requests) != 1 {
		t.Errorf("Expected 1 request with status 'inAction', got %d", len(requests))
	}
}

func ExampleDatabase() {
	// Create a JSON-based database (default mode)
	db, err := NewDatabase(Config{
		Mode:     ModeJSON,
		DataPath: "./my_data",
	})
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Define schema for customers table
	schema := TableSchema{
		Fields: []FieldDefinition{
			{Name: "id", Type: "string"},
			{Name: "email", Type: "string"},
			{Name: "name", Type: "string"},
			{Name: "createdAt", Type: "date"},
		},
		UniqueFields:   []string{"email"},
		RequiredFields: []string{"email", "name"},
	}

	// Create table
	db.CreateTable("customers", schema)

	// Insert data
	customer := map[string]interface{}{
		"id":    "customer-123",
		"email": "user@example.com",
		"name":  "John Doe",
	}
	db.Insert("customers", customer)

	// Get data
	retrieved, _ := db.Get("customers", "customer-123")
	fmt.Printf("Customer: %v\n", retrieved)

	// Update schema (add new field)
	schema.Fields = append(schema.Fields, FieldDefinition{
		Name:         "phone",
		Type:         "string",
		DefaultValue: "",
	})
	db.UpdateTableSchema("customers", schema)

	// Old records will automatically get the new field with default value
	retrieved, _ = db.Get("customers", "customer-123")
	fmt.Printf("Customer with new field: %v\n", retrieved)
}
