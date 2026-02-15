package auth

import (
	"context"
	"log"

	"github.com/workos/workos-go/v4/pkg/usermanagement"
)

var clientID string

func InitWorkOS(apiKey, cid string) {
	usermanagement.SetAPIKey(apiKey)
	clientID = cid
}

func CreateMagicLink(ctx context.Context, email string) error {
	log.Printf("[WORKOS] CreateMagicLink: sending magic auth code to email=%s", email)
	err := usermanagement.SendMagicAuthCode(ctx, usermanagement.SendMagicAuthCodeOpts{
		Email: email,
	})
	if err != nil {
		log.Printf("[WORKOS] CreateMagicLink: SendMagicAuthCode failed for email=%s: %v", email, err)
		return err
	}
	log.Printf("[WORKOS] CreateMagicLink: magic auth code sent successfully to email=%s", email)
	return nil
}

func AuthenticateWithCode(ctx context.Context, code, email string) (usermanagement.AuthenticateResponse, error) {
	log.Printf("[WORKOS] AuthenticateWithCode: authenticating code for email=%s", email)
	opts := usermanagement.AuthenticateWithMagicAuthOpts{
		ClientID: clientID,
		Code:     code,
	}

	// Email is required by WorkOS for magic auth validation
	if email != "" {
		opts.Email = email
	}

	resp, err := usermanagement.AuthenticateWithMagicAuth(ctx, opts)
	if err != nil {
		log.Printf("[WORKOS] AuthenticateWithCode: authentication failed for email=%s: %v", email, err)
		return resp, err
	}
	log.Printf("[WORKOS] AuthenticateWithCode: authentication successful for email=%s, user_id=%s", email, resp.User.ID)
	return resp, nil
}
