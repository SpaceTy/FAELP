package db

import (
	"context"
	"database/sql"
	"time"

	"distribution_backend/internal/domain"
)

type userRow struct {
	ID           string
	Username     string
	PasswordHash string
	IsAdmin      bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// CreateUser creates a new user
func (s *Store) CreateUser(ctx context.Context, input domain.CreateUserInput) (domain.User, error) {
	var row userRow
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO users (username, password_hash, is_admin)
		VALUES ($1, $2, $3)
		RETURNING id, username, password_hash, is_admin, created_at, updated_at
	`, input.Username, input.PasswordHash, input.IsAdmin).Scan(
		&row.ID, &row.Username, &row.PasswordHash, &row.IsAdmin,
		&row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.User{}, err
	}
	return mapUser(row), nil
}

// GetUserByID returns a user by ID
func (s *Store) GetUserByID(ctx context.Context, id string) (domain.User, error) {
	var row userRow
	err := s.db.QueryRowContext(ctx, `
		SELECT id, username, password_hash, is_admin, created_at, updated_at
		FROM users
		WHERE id = $1
	`, id).Scan(
		&row.ID, &row.Username, &row.PasswordHash, &row.IsAdmin,
		&row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.User{}, err
	}
	return mapUser(row), nil
}

// GetUserByUsername returns a user by username
func (s *Store) GetUserByUsername(ctx context.Context, username string) (domain.User, error) {
	var row userRow
	err := s.db.QueryRowContext(ctx, `
		SELECT id, username, password_hash, is_admin, created_at, updated_at
		FROM users
		WHERE username = $1
	`, username).Scan(
		&row.ID, &row.Username, &row.PasswordHash, &row.IsAdmin,
		&row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return domain.User{}, err
	}
	return mapUser(row), nil
}

// ListUsers returns all users (without password hashes in response)
func (s *Store) ListUsers(ctx context.Context) ([]domain.User, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, username, password_hash, is_admin, created_at, updated_at
		FROM users
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.User
	for rows.Next() {
		var row userRow
		if err := rows.Scan(
			&row.ID, &row.Username, &row.PasswordHash, &row.IsAdmin,
			&row.CreatedAt, &row.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, mapUser(row))
	}
	if result == nil {
		result = []domain.User{}
	}
	return result, rows.Err()
}

// UpdateUser updates a user's password or admin status
func (s *Store) UpdateUser(ctx context.Context, id string, input domain.UpdateUserInput) (domain.User, error) {
	// Build update query dynamically based on what's provided
	var row userRow

	if input.PasswordHash != nil && input.IsAdmin != nil {
		err := s.db.QueryRowContext(ctx, `
			UPDATE users
			SET password_hash = $2, is_admin = $3
			WHERE id = $1
			RETURNING id, username, password_hash, is_admin, created_at, updated_at
		`, id, *input.PasswordHash, *input.IsAdmin).Scan(
			&row.ID, &row.Username, &row.PasswordHash, &row.IsAdmin,
			&row.CreatedAt, &row.UpdatedAt,
		)
		if err != nil {
			return domain.User{}, err
		}
	} else if input.PasswordHash != nil {
		err := s.db.QueryRowContext(ctx, `
			UPDATE users
			SET password_hash = $2
			WHERE id = $1
			RETURNING id, username, password_hash, is_admin, created_at, updated_at
		`, id, *input.PasswordHash).Scan(
			&row.ID, &row.Username, &row.PasswordHash, &row.IsAdmin,
			&row.CreatedAt, &row.UpdatedAt,
		)
		if err != nil {
			return domain.User{}, err
		}
	} else if input.IsAdmin != nil {
		err := s.db.QueryRowContext(ctx, `
			UPDATE users
			SET is_admin = $2
			WHERE id = $1
			RETURNING id, username, password_hash, is_admin, created_at, updated_at
		`, id, *input.IsAdmin).Scan(
			&row.ID, &row.Username, &row.PasswordHash, &row.IsAdmin,
			&row.CreatedAt, &row.UpdatedAt,
		)
		if err != nil {
			return domain.User{}, err
		}
	} else {
		return s.GetUserByID(ctx, id)
	}

	return mapUser(row), nil
}

// DeleteUser deletes a user by ID
func (s *Store) DeleteUser(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `
		DELETE FROM users
		WHERE id = $1
	`, id)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// UserExists checks if a user with the given username exists
func (s *Store) UserExists(ctx context.Context, username string) (bool, error) {
	var exists bool
	err := s.db.QueryRowContext(ctx, `
		SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)
	`, username).Scan(&exists)
	return exists, err
}

func mapUser(row userRow) domain.User {
	return domain.User{
		ID:           row.ID,
		Username:     row.Username,
		PasswordHash: row.PasswordHash,
		IsAdmin:      row.IsAdmin,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}
}
