package domain

import "time"

// User represents a system user for authentication
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // Never expose in JSON
	IsAdmin      bool      `json:"isAdmin"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// CreateUserInput contains fields for creating a new user
type CreateUserInput struct {
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	IsAdmin      bool   `json:"isAdmin"`
}

// UpdateUserInput contains fields for updating a user
type UpdateUserInput struct {
	PasswordHash *string `json:"-"`
	IsAdmin      *bool   `json:"isAdmin"`
}
