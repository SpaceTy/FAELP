package domain

import "time"

type Customer struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	Name          string    `json:"name"`
	Token         string    `json:"token"`
	WorkOSUserID  string    `json:"workosUserId"`
	EmailVerified bool      `json:"emailVerified"`
	CreatedAt     time.Time `json:"createdAt"`
}
