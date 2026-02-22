package db

import (
	"database/sql"
	"time"
)

type materialInstanceRow struct {
	ID               string
	HumanCode        string
	TypeID           string
	Description      string
	Status           string
	UseCount         int
	Location         string
	CurrentRequestID sql.NullString
	CreatedAt        time.Time
	UpdatedAt        time.Time
}
