package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

type Service struct {
	apiKey     string
	httpClient *http.Client
	fromEmail  string
}

func NewService(apiKey string) *Service {
	return &Service{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		fromEmail: "automated@ehalp.spacety.dev",
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
	DistributionCenter string
}

func (s *Service) SendRequestStatusNotification(ctx context.Context, params RequestStatusNotificationParams) error {
	var subject, htmlBody, textBody string

	switch params.NewStatus {
	case "inAction":
		subject = "Your material request is now being processed"
		htmlBody = fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h2 style="color: #333;">Your Material Request is Being Processed</h2>
<p>Dear %s,</p>
<p>Good news! Your material request (#%s) has been shipped and is now in action.</p>
<p><strong>Tracking Code:</strong> %s</p>
<p>You can use this tracking code to monitor the delivery status of your materials.</p>
<p>Thank you for using FAELP.</p>
</body>
</html>`, params.CustomerName, params.RequestID, params.TrackingCode)
		textBody = fmt.Sprintf(`Dear %s,

Good news! Your material request (#%s) has been shipped and is now in action.

Tracking Code: %s

You can use this tracking code to monitor the delivery status of your materials.

Thank you for using FAELP.`, params.CustomerName, params.RequestID, params.TrackingCode)

	case "pending":
		if params.PreviousStatus == "inAction" {
			subject = "Your material request status has changed"
			htmlBody = fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h2 style="color: #333;">Material Request Status Update</h2>
<p>Dear %s,</p>
<p>Your material request (#%s) has been cancelled and returned to pending status.</p>
<p>The distribution center is no longer able to fulfill this request. Your request will be available for other distribution centers to claim.</p>
<p>If you have any questions, please contact support.</p>
<p>Thank you for your understanding.</p>
</body>
</html>`, params.CustomerName, params.RequestID)
			textBody = fmt.Sprintf(`Dear %s,

Your material request (#%s) has been cancelled and returned to pending status.

The distribution center is no longer able to fulfill this request. Your request will be available for other distribution centers to claim.

If you have any questions, please contact support.

Thank you for your understanding.`, params.CustomerName, params.RequestID)
		} else {
			return nil
		}

	default:
		return nil
	}

	return s.Send(ctx, params.CustomerEmail, subject, htmlBody, textBody)
}
