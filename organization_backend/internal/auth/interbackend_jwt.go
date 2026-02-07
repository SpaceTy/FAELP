package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type InterbackendClaims struct {
	CenterID   string `json:"centerId"`
	CenterCode string `json:"centerCode"`
	Scope      string `json:"scope"`
	jwt.RegisteredClaims
}

func GenerateInterbackendToken(centerID, centerCode, secret string, ttl time.Duration) (string, time.Time, error) {
	exp := time.Now().Add(ttl)
	claims := InterbackendClaims{
		CenterID:   centerID,
		CenterCode: centerCode,
		Scope:      "interbackend",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   centerID,
			Issuer:    "organization-backend",
			Audience:  []string{"distribution_backend"},
			ExpiresAt: jwt.NewNumericDate(exp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(secret))
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp.UTC(), nil
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
		return nil, jwt.ErrSignatureInvalid
	}
	if claims.Scope != "interbackend" {
		return nil, errors.New("invalid token scope")
	}
	return claims, nil
}
