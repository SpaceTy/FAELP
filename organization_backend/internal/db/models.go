package db

import (
	"time"
)

type userRow struct {
	ID            string
	Email         string
	Name          string
	Token         string
	WorkOSUserID  string
	EmailVerified bool
	IsAdmin       bool
	CreatedAt     time.Time
}
