package db

import (
	"strings"
	"testing"
)

func TestGenerateDonationBankTransferMatchingCode(t *testing.T) {
	code, err := generateDonationBankTransferMatchingCode()
	if err != nil {
		t.Fatalf("generate matching code: %v", err)
	}
	if len(code) != 10 {
		t.Fatalf("expected code length 10, got %d", len(code))
	}
	for _, char := range code {
		if !strings.ContainsRune(donationBankTransferMatchingCodeAlphabet, char) {
			t.Fatalf("unexpected character in matching code: %q", char)
		}
	}
}
