import type { Material } from '@/types/material';

const API_BASE = '/api';

export interface MaterialAvailabilityEvent {
  type: 'snapshot' | 'update' | 'error';
  materials?: Material[];
  material?: Material;
  action?: string;
  message?: string;
}

type EventCallback = (data: MaterialAvailabilityEvent) => void;
type ErrorCallback = (error: Error) => void;

interface SseSubscription {
  unsubscribe: () => void;
}

class MaterialSseService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: number | null = null;
  private currentReconnectDelay = 2000; // Start with 2 second delay
  private maxReconnectDelay = 60000; // Max 60 second delay
  private consecutiveErrors = 0;
  private errorCallbackThreshold = 3;
  private lastErrorTime = 0;
  private isConnecting = false;

  subscribeToAvailability(
    onEvent: EventCallback,
    onError?: ErrorCallback
  ): SseSubscription {
    const url = `${API_BASE}/material-types/subscribe`;
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
        const data = JSON.parse(event.data) as MaterialAvailabilityEvent;
        onEvent(data);
        // Reset reconnection state on successful message
        this.reconnectAttempts = 0;
        this.currentReconnectDelay = 2000;
        this.consecutiveErrors = 0;
      } catch (err) {
        console.error('Failed to parse material SSE event:', err);
      }
    };

    this.eventSource.onerror = (error) => {
      this.isConnecting = false;
      this.consecutiveErrors++;
      const now = Date.now();

      // Log the error for debugging
      if (this.reconnectAttempts === 0) {
        console.error('Material SSE connection error:', error);
        console.error('Failed to connect to:', url);
      }

      // Only call onError callback after threshold consecutive errors
      // and rate-limit to at most once every 5 seconds
      if (onError &&
          this.consecutiveErrors >= this.errorCallbackThreshold &&
          now - this.lastErrorTime > 5000) {
        this.lastErrorTime = now;
        onError(new Error('Material SSE connection error'));
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
          console.log(`Material SSE reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
        }
        this.reconnectTimeout = window.setTimeout(() => {
          this.connect(url, onEvent, onError);
        }, delay);
        this.reconnectAttempts++;
      } else {
        console.error('Material SSE max reconnection attempts reached');
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

export const materialSse = new MaterialSseService();
export type { SseSubscription };
