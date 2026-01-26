package database_handler

import "fmt"

// ErrorCode represents database error types
type ErrorCode string

const (
	ErrCodeNotFound      ErrorCode = "NOT_FOUND"
	ErrCodeAlreadyExists ErrorCode = "ALREADY_EXISTS"
	ErrCodeValidation    ErrorCode = "VALIDATION_ERROR"
	ErrCodeInvalidConfig ErrorCode = "INVALID_CONFIG"
	ErrCodeIO            ErrorCode = "IO_ERROR"
	ErrCodeInternal      ErrorCode = "INTERNAL_ERROR"
	ErrCodeConnection    ErrorCode = "CONNECTION_ERROR"
)

// DatabaseError represents a database operation error
type DatabaseError struct {
	Code    ErrorCode
	Message string
	Cause   error
}

func (e *DatabaseError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *DatabaseError) Unwrap() error {
	return e.Cause
}

// NewNotFoundError creates a not found error
func NewNotFoundError(message string) *DatabaseError {
	return &DatabaseError{
		Code:    ErrCodeNotFound,
		Message: message,
	}
}

// NewValidationError creates a validation error
func NewValidationError(message string) *DatabaseError {
	return &DatabaseError{
		Code:    ErrCodeValidation,
		Message: message,
	}
}

// NewIOError creates an IO error
func NewIOError(message string, cause error) *DatabaseError {
	return &DatabaseError{
		Code:    ErrCodeIO,
		Message: message,
		Cause:   cause,
	}
}
