package shippinglabel

import (
	"bytes"
	"fmt"
	"strings"
	"time"
)

const (
	// 4x6 inch label at PDF points (72 points per inch).
	labelWidthPoints  = 288.0
	labelHeightPoints = 432.0
)

// Data contains shipping label fields rendered on the PDF.
type Data struct {
	RequestID      string
	ShipToName     string
	AddressLine1   string
	AddressLine2   string
	City           string
	ZipCode        string
	DeliveryDate   string
	GeneratedAtUTC time.Time
}

// Generate4x6PDF builds a single-page 4x6 inch shipping label PDF.
func Generate4x6PDF(data Data) ([]byte, error) {
	if data.GeneratedAtUTC.IsZero() {
		data.GeneratedAtUTC = time.Now().UTC()
	}

	var content strings.Builder
	content.Grow(2048)

	// Outer border.
	content.WriteString("0.8 w 8 8 272 416 re S\n")
	// Divider between header and destination block.
	content.WriteString("0.5 w 16 332 m 272 332 l S\n")

	writeText(&content, "F2", 18, 16, 402, "SHIPPING LABEL")
	writeText(&content, "F1", 10, 16, 386, fmt.Sprintf("Request: %s", fallback(data.RequestID, "N/A")))

	writeText(&content, "F2", 14, 16, 355, "SHIP TO")

	y := 334.0
	for _, line := range wrapText(fallback(data.ShipToName, "Unknown Recipient"), 28) {
		writeText(&content, "F2", 22, 16, y, line)
		y -= 24
	}

	y -= 4
	for _, line := range wrapText(fallback(data.AddressLine1, "Unknown Address"), 34) {
		writeText(&content, "F1", 16, 16, y, line)
		y -= 18
	}
	if strings.TrimSpace(data.AddressLine2) != "" {
		for _, line := range wrapText(data.AddressLine2, 34) {
			writeText(&content, "F1", 16, 16, y, line)
			y -= 18
		}
	}

	cityZip := strings.TrimSpace(strings.TrimSpace(data.City) + " " + strings.TrimSpace(data.ZipCode))
	for _, line := range wrapText(fallback(cityZip, "Unknown City"), 34) {
		writeText(&content, "F2", 18, 16, y, line)
		y -= 20
	}

	writeText(&content, "F1", 10, 16, 56, fmt.Sprintf("Delivery Date: %s", fallback(data.DeliveryDate, "N/A")))
	writeText(&content, "F1", 10, 16, 42, fmt.Sprintf("Generated (UTC): %s", data.GeneratedAtUTC.Format("2006-01-02 15:04")))
	writeText(&content, "F1", 9, 16, 26, "Label Size: 4x6 in")

	return buildPDF(content.String())
}

func writeText(content *strings.Builder, font string, fontSize float64, x float64, y float64, text string) {
	escaped := escapePDFText(text)
	content.WriteString(fmt.Sprintf("BT /%s %.1f Tf %.1f %.1f Td (%s) Tj ET\n", font, fontSize, x, y, escaped))
}

func fallback(value string, def string) string {
	if strings.TrimSpace(value) == "" {
		return def
	}
	return strings.TrimSpace(value)
}

func wrapText(input string, maxChars int) []string {
	text := strings.TrimSpace(input)
	if text == "" {
		return []string{""}
	}
	if maxChars <= 0 {
		return []string{text}
	}

	words := strings.Fields(text)
	lines := make([]string, 0, len(words))
	current := ""
	for _, word := range words {
		if current == "" {
			current = word
			continue
		}
		next := current + " " + word
		if len([]rune(next)) <= maxChars {
			current = next
			continue
		}
		lines = append(lines, current)
		current = word
	}
	if current != "" {
		lines = append(lines, current)
	}
	return lines
}

func escapePDFText(input string) string {
	replacer := strings.NewReplacer(
		`\\`, `\\\\`,
		`(`, `\(`,
		`)`, `\)`,
	)
	return replacer.Replace(input)
}

func buildPDF(content string) ([]byte, error) {
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.0f %.0f] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>", labelWidthPoints, labelHeightPoints),
		fmt.Sprintf("<< /Length %d >>\nstream\n%sendstream", len(content), content),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
	}

	var buf bytes.Buffer
	if _, err := buf.WriteString("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"); err != nil {
		return nil, err
	}

	offsets := make([]int, 0, len(objects)+1)
	offsets = append(offsets, 0)

	for i, obj := range objects {
		offsets = append(offsets, buf.Len())
		if _, err := buf.WriteString(fmt.Sprintf("%d 0 obj\n%s\nendobj\n", i+1, obj)); err != nil {
			return nil, err
		}
	}

	xrefStart := buf.Len()
	if _, err := buf.WriteString(fmt.Sprintf("xref\n0 %d\n", len(objects)+1)); err != nil {
		return nil, err
	}
	if _, err := buf.WriteString("0000000000 65535 f \n"); err != nil {
		return nil, err
	}
	for i := 1; i < len(offsets); i++ {
		if _, err := buf.WriteString(fmt.Sprintf("%010d 00000 n \n", offsets[i])); err != nil {
			return nil, err
		}
	}

	if _, err := buf.WriteString(fmt.Sprintf("trailer << /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xrefStart)); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
