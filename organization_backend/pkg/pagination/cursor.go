package pagination

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

type Cursor struct {
	Time time.Time
	ID   string
}

func Encode(cursor Cursor) string {
	raw := fmt.Sprintf("%s|%s", cursor.Time.Format(time.RFC3339Nano), cursor.ID)
	return base64.StdEncoding.EncodeToString([]byte(raw))
}

func Decode(encoded string) (Cursor, error) {
	if encoded == "" {
		return Cursor{}, errors.New("empty cursor")
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return Cursor{}, err
	}
	parts := strings.SplitN(string(data), "|", 2)
	if len(parts) != 2 {
		return Cursor{}, errors.New("invalid cursor")
	}
	ts, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return Cursor{}, err
	}
	return Cursor{Time: ts, ID: parts[1]}, nil
}
