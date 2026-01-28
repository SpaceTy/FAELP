import { useState, useEffect, useCallback } from 'preact/hooks';
import { api } from '@/services/api';
import { sse } from '@/services/sse';
import type { Request, ListRequestsParams, RequestEvent } from '@/types/request';

interface UseRequestsResult {
  requests: Request[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  nextCursor?: string;
  loadMore: () => void;
  refresh: () => void;
}

export function useRequests(params: ListRequestsParams): UseRequestsResult {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  const fetchRequests = useCallback(async (cursor?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use getMyRequests if customerId is provided, otherwise use listRequests
      let result;
      if (params.customerId) {
        result = await api.getMyRequests({
          status: params.status,
          cursor,
          limit: params.limit || 20,
          q: params.q,
          from: params.from,
          to: params.to
        });
      } else {
        result = await api.listRequests({
          ...params,
          cursor,
          limit: params.limit || 20
        });
      }

      if (cursor) {
        setRequests((prev: Request[]) => [...prev, ...result.requests]);
      } else {
        setRequests(result.requests);
      }
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [params]);

  const loadMore = useCallback(() => {
    if (nextCursor && !loading) {
      fetchRequests(nextCursor);
    }
  }, [nextCursor, loading, fetchRequests]);

  const refresh = useCallback(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const subscription = sse.subscribeToList(
      params,
      (event: RequestEvent) => {
        if (event.type === 'update' && event.request) {
          const request = event.request;
          setRequests((prev: Request[]) => {
            const index = prev.findIndex((r: Request) => r.id === event.requestId);
            if (index >= 0) {
              const updated: Request[] = [...prev];
              updated[index] = request;
              return updated;
            }
            return [request, ...prev];
          });
        } else if (event.type === 'deleted') {
          setRequests((prev: Request[]) => prev.filter((r: Request) => r.id !== event.requestId));
        }
      },
      (err) => {
        console.error('SSE error:', err);
      }
    );

    return () => subscription.unsubscribe();
  }, [params]);

  return {
    requests,
    loading,
    error,
    hasMore,
    nextCursor,
    loadMore,
    refresh
  };
}

interface UseRequestResult {
  request: Request | null;
  loading: boolean;
  error: string | null;
}

export function useRequest(requestId: string | null): UseRequestResult {
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(!!requestId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchRequest = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.getRequest(requestId);
        if (!cancelled) {
          setRequest(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load request');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRequest();

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;

    const subscription = sse.subscribeToRequest(
      requestId,
      (event: RequestEvent) => {
        if (event.type === 'snapshot' || event.type === 'update') {
          if (event.request) {
            setRequest(event.request);
          }
        } else if (event.type === 'deleted') {
          setRequest(null);
        }
      },
      (err) => {
        console.error('SSE error:', err);
      }
    );

    return () => subscription.unsubscribe();
  }, [requestId]);

  return { request, loading, error };
}
