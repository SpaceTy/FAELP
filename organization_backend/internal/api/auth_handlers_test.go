package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRequestMagicLinkCooldownBlocksRepeatedEmail(t *testing.T) {
	currentTime := time.Date(2026, time.March, 23, 17, 0, 0, 0, time.UTC)
	var sentEmails []string

	handler := &AuthHandler{
		MagicLinkCooldown: 15 * time.Second,
		now: func() time.Time {
			return currentTime
		},
		createMagicLink: func(_ context.Context, email string) error {
			sentEmails = append(sentEmails, email)
			return nil
		},
	}

	firstReq := httptest.NewRequest(http.MethodPost, "/api/auth/magic-link", strings.NewReader(`{"email":" Test@Example.com "}`))
	firstRR := httptest.NewRecorder()
	handler.RequestMagicLink(firstRR, firstReq)

	secondReq := httptest.NewRequest(http.MethodPost, "/api/auth/magic-link", strings.NewReader(`{"email":"test@example.com"}`))
	secondRR := httptest.NewRecorder()
	handler.RequestMagicLink(secondRR, secondReq)

	if firstRR.Code != http.StatusOK {
		t.Fatalf("expected first request to succeed, got %d", firstRR.Code)
	}
	if secondRR.Code != http.StatusTooManyRequests {
		t.Fatalf("expected second request to be rate limited, got %d", secondRR.Code)
	}
	if secondRR.Header().Get("Retry-After") != "15" {
		t.Fatalf("expected Retry-After 15, got %q", secondRR.Header().Get("Retry-After"))
	}
	if len(sentEmails) != 1 || sentEmails[0] != "test@example.com" {
		t.Fatalf("expected one normalized magic link send, got %v", sentEmails)
	}
}

func TestRequestMagicLinkCooldownExpiresAfterWindow(t *testing.T) {
	currentTime := time.Date(2026, time.March, 23, 17, 0, 0, 0, time.UTC)
	sendCount := 0

	handler := &AuthHandler{
		MagicLinkCooldown: 15 * time.Second,
		now: func() time.Time {
			return currentTime
		},
		createMagicLink: func(_ context.Context, email string) error {
			sendCount++
			if email != "test@example.com" {
				t.Fatalf("unexpected email %q", email)
			}
			return nil
		},
	}

	firstReq := httptest.NewRequest(http.MethodPost, "/api/auth/magic-link", strings.NewReader(`{"email":"test@example.com"}`))
	firstRR := httptest.NewRecorder()
	handler.RequestMagicLink(firstRR, firstReq)

	currentTime = currentTime.Add(15 * time.Second)

	secondReq := httptest.NewRequest(http.MethodPost, "/api/auth/magic-link", strings.NewReader(`{"email":"test@example.com"}`))
	secondRR := httptest.NewRecorder()
	handler.RequestMagicLink(secondRR, secondReq)

	if firstRR.Code != http.StatusOK || secondRR.Code != http.StatusOK {
		t.Fatalf("expected both requests to succeed, got %d and %d", firstRR.Code, secondRR.Code)
	}
	if sendCount != 2 {
		t.Fatalf("expected cooldown to expire after 15 seconds, got %d sends", sendCount)
	}
}

func TestRequestMagicLinkFailureDoesNotPoisonCooldown(t *testing.T) {
	currentTime := time.Date(2026, time.March, 23, 17, 0, 0, 0, time.UTC)
	sendCount := 0

	handler := &AuthHandler{
		MagicLinkCooldown: 15 * time.Second,
		now: func() time.Time {
			return currentTime
		},
		createMagicLink: func(_ context.Context, _ string) error {
			sendCount++
			if sendCount == 1 {
				return errors.New("provider failed")
			}
			return nil
		},
	}

	firstReq := httptest.NewRequest(http.MethodPost, "/api/auth/magic-link", strings.NewReader(`{"email":"test@example.com"}`))
	firstRR := httptest.NewRecorder()
	handler.RequestMagicLink(firstRR, firstReq)

	secondReq := httptest.NewRequest(http.MethodPost, "/api/auth/magic-link", strings.NewReader(`{"email":"test@example.com"}`))
	secondRR := httptest.NewRecorder()
	handler.RequestMagicLink(secondRR, secondReq)

	if firstRR.Code != http.StatusInternalServerError {
		t.Fatalf("expected first request to fail, got %d", firstRR.Code)
	}
	if secondRR.Code != http.StatusOK {
		t.Fatalf("expected second request to retry immediately after failure, got %d", secondRR.Code)
	}
	if sendCount != 2 {
		t.Fatalf("expected failed send to release cooldown, got %d send attempts", sendCount)
	}
}
