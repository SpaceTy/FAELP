package socket

import (
	"net"
	"os"
	"path/filepath"
)

// Listen creates a Unix domain socket listener
func Listen(socketPath string) (net.Listener, error) {
	// Remove existing socket file (stale from previous run)
	os.Remove(socketPath)

	// Create directory if needed
	dir := filepath.Dir(socketPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	// Create listener
	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		return nil, err
	}

	// Set permissions - owner read/write only
	if err := os.Chmod(socketPath, 0600); err != nil {
		listener.Close()
		return nil, err
	}

	return listener, nil
}
