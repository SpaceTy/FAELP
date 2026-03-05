import type { AuditEntry, AuditFilters, RollbackResult } from '@/types/audit';
import { authSignal } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

class AuditService {
  async listAuditEntries(filters: AuditFilters = {}): Promise<AuditEntry[]> {
    const params = new URLSearchParams();
    
    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.entityId) params.append('entityId', filters.entityId);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.action) params.append('action', filters.action);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await fetch(`${API_BASE}/api/audit?${params.toString()}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to list audit entries');
    }

    return response.json();
  }

  async getAuditEntry(id: number): Promise<AuditEntry> {
    const response = await fetch(`${API_BASE}/api/audit/${id}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get audit entry');
    }

    return response.json();
  }

  async rollbackAuditEntry(id: number): Promise<RollbackResult> {
    const response = await fetch(`${API_BASE}/api/audit/${id}/rollback`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to rollback audit entry');
    }

    return response.json();
  }

  private getAuthHeaders(): Record<string, string> {
    const token = authSignal.value?.token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }
}

export const auditService = new AuditService();
