package auth

import (
	"errors"

	"github.com/golang-jwt/jwt/v5"
)

type InterbackendClaims struct {
	CenterID   string `json:"centerId"`
	CenterCode string `json:"centerCode"`
	Scope      string `json:"scope"`
	jwt.RegisteredClaims
}

func ParseInterbackendToken(tokenString, secret string) (*InterbackendClaims, error) {
	tok, err := jwt.ParseWithClaims(tokenString, &InterbackendClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := tok.Claims.(*InterbackendClaims)
	if !ok || !tok.Valid {
		return nil, ErrInvalidToken
	}
	if claims.Scope != "interbackend" {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
