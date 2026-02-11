import type { RequestEvent, ListRequestsParams } from '@/types/request';
import { authSignal } from '@/context/AuthContext';

// Use relative URL to leverage Vite proxy in development, avoiding CORS issues
// The Vite proxy forwards /api/* to the backend and rewrites to /*
const API_BASE = '/api';

type EventCallback = (data: RequestEvent) => void;
type ErrorCallback = (error: Error) => void;

interface SseSubscription {
  unsubscribe: () => void;
}

class SseService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: number | null = null;
  private currentReconnectDelay = 2000; // Start with 2 second delay
  private maxReconnectDelay = 60000; // Max 60 second delay
  private consecutiveErrors = 0; // Track consecutive errors for suppression
  private errorCallbackThreshold = 3; // Only call onError after this many consecutive errors
  private lastErrorTime = 0; // Track last error time for rate limiting
  private isConnecting = false; // Prevent multiple simultaneous connection attempts

  subscribeToRequest(
    requestId: string,
    onEvent: EventCallback,
    onError?: ErrorCallback
  ): SseSubscription {
    const token = authSignal.value?.token;
    const query = new URLSearchParams();
    // SECURITY NOTE: EventSource doesn't support custom headers, so we pass the
    // JWT token via query parameter. This means the token may appear in server
    // logs, browser history, and referrer headers. Consider using short-lived
    // tokens specifically for SSE connections in production.
    if (token) query.set('token', token);

    const url = `${API_BASE}/requests/${requestId}/subscribe?${query}`;
    this.connect(url, onEvent, onError);

    return {
      unsubscribe: () => this.disconnect()
    };
  }

  subscribeToList(
    params: ListRequestsParams,
    onEvent: EventCallback,
    onError?: ErrorCallback
  ): SseSubscription {
    const token = authSignal.value?.token;
    const query = new URLSearchParams();
    if (params.customerId) query.set('customerId', params.customerId);
    if (params.status) query.set('status', params.status);
    if (params.q) query.set('q', params.q);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    // SECURITY NOTE: EventSource doesn't support custom headers, so we pass the
    // JWT token via query parameter. This means the token may appear in server
    // logs, browser history, and referrer headers. Consider using short-lived
    // tokens specifically for SSE connections in production.
    if (token) query.set('token', token);

    const url = `${API_BASE}/requests/subscribe?${query}`;
    this.connect(url, onEvent, onError);

    return {
      unsubscribe: () => this.disconnect()
    };
  }

  private connect(
    url: string,
    onEvent: EventCallback,
    onError?: ErrorCallback
  ): void {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      return;
    }
    
    this.disconnect();
    this.isConnecting = true;

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.isConnecting = false;
      // Reset error state on successful connection
      this.consecutiveErrors = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RequestEvent;
        onEvent(data);
        // Reset reconnection state on successful message
        this.reconnectAttempts = 0;
        this.currentReconnectDelay = 2000;
        this.consecutiveErrors = 0; // Reset consecutive errors on success
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    this.eventSource.onerror = () => {
      this.isConnecting = false;
      this.consecutiveErrors++;
      const now = Date.now();

      // Only call onError callback after threshold consecutive errors
      // and rate-limit to at most once every 5 seconds
      if (onError && 
          this.consecutiveErrors >= this.errorCallbackThreshold &&
          now - this.lastErrorTime > 5000) {
        this.lastErrorTime = now;
        onError(new Error('SSE connection error'));
      }

      this.eventSource?.close();

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // Exponential backoff with cap
        const delay = Math.min(
          this.currentReconnectDelay * Math.pow(2, this.reconnectAttempts),
          this.maxReconnectDelay
        );
        // Only log reconnection attempts occasionally to reduce spam
        if (this.reconnectAttempts === 0 || this.reconnectAttempts % 3 === 0) {
          console.log(`SSE reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
        }
        this.reconnectTimeout = window.setTimeout(() => {
          this.connect(url, onEvent, onError);
        }, delay);
        this.reconnectAttempts++;
      } else {
        console.error('SSE max reconnection attempts reached');
      }
    };
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.eventSource?.close();
    this.eventSource = null;
    // Reset state on explicit disconnect
    this.reconnectAttempts = 0;
    this.consecutiveErrors = 0;
    this.currentReconnectDelay = 2000;
    this.isConnecting = false;
  }
}

export const sse = new SseService();
export type { SseSubscription };
