import type { RequestEvent, ListRequestsParams } from '@/types/request';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

type EventCallback = (data: RequestEvent) => void;
type ErrorCallback = (error: Error) => void;

interface SseSubscription {
  unsubscribe: () => void;
}

class SseService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;

  subscribeToRequest(
    requestId: string,
    onEvent: EventCallback,
    onError?: ErrorCallback
  ): SseSubscription {
    const url = `${API_BASE}/requests/${requestId}/subscribe`;
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
    const query = new URLSearchParams();
    if (params.customerId) query.set('customerId', params.customerId);
    if (params.status) query.set('status', params.status);
    if (params.q) query.set('q', params.q);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);

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
    this.disconnect();

    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RequestEvent;
        onEvent(data);
        this.reconnectAttempts = 0;
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    this.eventSource.onerror = () => {
      if (onError) {
        onError(new Error('SSE connection error'));
      }

      this.eventSource?.close();

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        this.reconnectTimeout = window.setTimeout(() => {
          this.connect(url, onEvent, onError);
        }, delay);
        this.reconnectAttempts++;
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
  }
}

export const sse = new SseService();
export type { SseSubscription };
