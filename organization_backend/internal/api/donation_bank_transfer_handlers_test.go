package api

import "testing"

func TestDonationBankTransferPrivacyConsentTextIsSet(t *testing.T) {
	if donationBankTransferPrivacyConsentText == "" {
		t.Fatal("expected privacy consent text to be set")
	}
}
