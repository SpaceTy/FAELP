package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Service struct {
	apiKey     string
	httpClient *http.Client
	fromEmail  string
}

func NewService(apiKey, fromEmail string) *Service {
	from := strings.TrimSpace(fromEmail)
	if from == "" {
		from = "onboarding@resend.dev"
	}

	return &Service{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		fromEmail: from,
	}
}

type SendEmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Html    string   `json:"html"`
	Text    string   `json:"text"`
}

type SendEmailResponse struct {
	Id      string `json:"id"`
	From    string `json:"from"`
	To      string `json:"to"`
	Created string `json:"created_at"`
}

type resendErrorResponse struct {
	StatusCode int    `json:"statusCode"`
	Name       string `json:"name"`
	Message    string `json:"message"`
}

func (s *Service) Send(ctx context.Context, to, subject, htmlBody, textBody string) error {
	if s.apiKey == "" {
		slog.Warn("email_service_send_skipped_no_api_key", "to", to, "subject", subject)
		return nil
	}

	req := SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{to},
		Subject: subject,
		Html:    htmlBody,
		Text:    textBody,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal email request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create email request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send email request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read email response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errResp resendErrorResponse
		if jsonErr := json.Unmarshal(respBody, &errResp); jsonErr == nil {
			return fmt.Errorf("email send failed: %s - %s", errResp.Name, errResp.Message)
		}
		return fmt.Errorf("email send failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var successResp SendEmailResponse
	if err := json.Unmarshal(respBody, &successResp); err != nil {
		slog.Warn("email_send_response_parse_failed", "error", err.Error())
	}

	slog.Info("email_sent", "id", successResp.Id, "to", to, "subject", subject)
	return nil
}

type RequestStatusNotificationParams struct {
	CustomerName       string
	CustomerEmail      string
	RequestID          string
	PreviousStatus     string
	NewStatus          string
	TrackingCode       string
	TrackingURL        string
	DistributionCenter string
}

func buildDHLTrackingURL(trackingCode string) string {
	code := strings.TrimSpace(trackingCode)
	if code == "" {
		return ""
	}

	return "https://www.dhl.com/global-en/home/tracking.html?tracking-id=" + url.QueryEscape(code) + "&submit=1"
}

func (s *Service) SendRequestStatusNotification(ctx context.Context, params RequestStatusNotificationParams) error {
	var (
		subject      string
		htmlTemplate string
		textTemplate string
	)

	switch params.NewStatus {
	case "inAction":
		subject = "Ihre Materialanfrage wurde versendet"
		htmlTemplate = "request_in_action.html"
		textTemplate = "request_in_action.txt"

	case "cancelled":
		subject = "Ihre Materialanfrage wurde storniert"
		htmlTemplate = "request_cancelled_unfulfilled.html"
		textTemplate = "request_cancelled_unfulfilled.txt"

	default:
		return nil
	}

	if params.NewStatus == "inAction" {
		params.TrackingURL = buildDHLTrackingURL(params.TrackingCode)
	}

	htmlBody, err := renderHTMLTemplate(htmlTemplate, params)
	if err != nil {
		return fmt.Errorf("failed to render html email template %q: %w", htmlTemplate, err)
	}

	textBody, err := renderTextTemplate(textTemplate, params)
	if err != nil {
		return fmt.Errorf("failed to render text email template %q: %w", textTemplate, err)
	}

	return s.Send(ctx, params.CustomerEmail, subject, htmlBody, textBody)
}
