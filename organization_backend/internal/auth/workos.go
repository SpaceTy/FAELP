package auth

import (
	"context"

	"github.com/workos/workos-go/v4/pkg/usermanagement"
)

var clientID string

func InitWorkOS(apiKey, cid string) {
	usermanagement.SetAPIKey(apiKey)
	clientID = cid
}

func CreateMagicLink(ctx context.Context, email string) error {
	return usermanagement.SendMagicAuthCode(ctx, usermanagement.SendMagicAuthCodeOpts{
		Email: email,
	})
}

func AuthenticateWithCode(ctx context.Context, code, email string) (usermanagement.AuthenticateResponse, error) {
	opts := usermanagement.AuthenticateWithMagicAuthOpts{
		ClientID: clientID,
		Code:     code,
	}

	// Email is required by WorkOS for magic auth validation
	if email != "" {
		opts.Email = email
	}

	return usermanagement.AuthenticateWithMagicAuth(ctx, opts)
}
