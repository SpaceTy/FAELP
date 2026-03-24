package api

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPFromRequestPrefersXForwardedFor(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/donation-bank-transfer-forms", nil)
	req.RemoteAddr = "127.0.0.1:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.8, 198.51.100.4")
	req.Header.Set("X-Real-IP", "198.51.100.9")

	got := clientIPFromRequest(req)
	if got != "203.0.113.8" {
		t.Fatalf("expected forwarded ip, got %q", got)
	}
}

func TestClientIPFromRequestFallsBackToRemoteAddr(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/donation-bank-transfer-forms", nil)
	req.RemoteAddr = "198.51.100.12:9876"

	got := clientIPFromRequest(req)
	if got != "198.51.100.12" {
		t.Fatalf("expected remote addr ip, got %q", got)
	}
}
