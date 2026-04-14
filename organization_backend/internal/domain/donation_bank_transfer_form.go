package domain

import "time"

type DonationBankTransferForm struct {
	ID                     string    `json:"id"`
	MatchingCode           string    `json:"matchingCode"`
	Name                   string    `json:"name"`
	Address                string    `json:"address"`
	Email                  string    `json:"email"`
	PhoneNumber            string    `json:"phoneNumber"`
	SubmittedIP            string    `json:"submittedIp"`
	PrivacyConsentAccepted bool      `json:"privacyConsentAccepted"`
	PrivacyConsentText     string    `json:"privacyConsentText"`
	PrivacyConsentAt       time.Time `json:"privacyConsentAt"`
	CreatedAt              time.Time `json:"createdAt"`
}

type CreateDonationBankTransferFormInput struct {
	Name                   string
	Address                string
	Email                  string
	PhoneNumber            string
	SubmittedIP            string
	PrivacyConsentAccepted bool
	PrivacyConsentText     string
	PrivacyConsentAt       time.Time
}
