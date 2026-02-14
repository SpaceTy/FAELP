package shippinglabel

import (
	"strings"
	"testing"
	"time"
)

func TestGenerate4x6PDF(t *testing.T) {
	out, err := Generate4x6PDF(Data{
		RequestID:      "req-123",
		ShipToName:     "Jane Doe",
		AddressLine1:   "123 Main Street",
		AddressLine2:   "Suite 4B",
		City:           "Springfield",
		ZipCode:        "12345",
		DeliveryDate:   "2026-02-16",
		GeneratedAtUTC: time.Date(2026, 2, 14, 12, 0, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("Generate4x6PDF returned error: %v", err)
	}

	pdf := string(out)
	if !strings.HasPrefix(pdf, "%PDF-1.4") {
		t.Fatalf("missing PDF header")
	}
	if !strings.Contains(pdf, "/MediaBox [0 0 288 432]") {
		t.Fatalf("missing 4x6 media box")
	}
	if !strings.Contains(pdf, "Request: req-123") {
		t.Fatalf("missing request id in label text")
	}
}
