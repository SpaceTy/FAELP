package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"organization_backend/internal/db"
	"organization_backend/internal/domain"
)

const donationBankTransferPrivacyConsentText = "Ich willige ein, dass meine im Formular angegebenen personenbezogenen Daten zum Zweck der Bearbeitung meiner Spendenueberweisung gespeichert und verarbeitet werden."

type DonationBankTransferHandler struct {
	Store *db.Store
}

type createDonationBankTransferFormRequest struct {
	Name                   string `json:"name"`
	Address                string `json:"address"`
	Email                  string `json:"email"`
	PhoneNumber            string `json:"phoneNumber"`
	PrivacyConsentAccepted bool   `json:"privacyConsentAccepted"`
}

func (h *DonationBankTransferHandler) CreateDonationBankTransferForm(w http.ResponseWriter, r *http.Request) {
	var req createDonationBankTransferFormRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	name := strings.TrimSpace(req.Name)
	address := strings.TrimSpace(req.Address)
	email := strings.TrimSpace(req.Email)
	phoneNumber := strings.TrimSpace(req.PhoneNumber)

	switch {
	case name == "":
		writeError(w, http.StatusBadRequest, "validation_error", "Name is required")
		return
	case address == "":
		writeError(w, http.StatusBadRequest, "validation_error", "Address is required")
		return
	case email == "":
		writeError(w, http.StatusBadRequest, "validation_error", "Email is required")
		return
	case phoneNumber == "":
		writeError(w, http.StatusBadRequest, "validation_error", "Phone number is required")
		return
	case !req.PrivacyConsentAccepted:
		writeError(w, http.StatusBadRequest, "privacy_consent_required", donationBankTransferPrivacyConsentText)
		return
	}

	if _, err := mail.ParseAddress(email); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", "A valid email address is required")
		return
	}

	submittedIP := clientIPFromRequest(r)
	if submittedIP == "" {
		writeError(w, http.StatusBadRequest, "invalid_client_ip", "Could not determine client IP address")
		return
	}

	now := time.Now().UTC()
	created, err := h.Store.CreateDonationBankTransferForm(r.Context(), domain.CreateDonationBankTransferFormInput{
		Name:                   name,
		Address:                address,
		Email:                  strings.ToLower(email),
		PhoneNumber:            phoneNumber,
		SubmittedIP:            submittedIP,
		PrivacyConsentAccepted: true,
		PrivacyConsentText:     donationBankTransferPrivacyConsentText,
		PrivacyConsentAt:       now,
	})
	if err != nil {
		if errors.Is(err, db.ErrDonationFormCooldown) {
			w.Header().Set("Retry-After", "60")
			writeError(w, http.StatusTooManyRequests, "cooldown_active", "Please wait 60 seconds before sending another form from the same IP address")
			return
		}

		slog.Error("create_donation_bank_transfer_form_failed", "error", err.Error(), "submitted_ip", submittedIP)
		writeError(w, http.StatusInternalServerError, "create_failed", "Failed to store donation form")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"status":       "ok",
		"id":           created.ID,
		"matchingCode": created.MatchingCode,
	})
}
