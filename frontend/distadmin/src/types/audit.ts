export interface AuditEntry {
  id: number;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  previousState: Record<string, unknown> | null;
  rolledBack: boolean;
  rolledBackAt: string | null;
  rolledBackBy: string | null;
}

export interface AuditFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface RollbackResult {
  success: boolean;
  message: string;
}
