export type LinkRequestState = 'pending' | 'approved' | 'rejected' | 'expired';

export interface LinkRequest {
  id: string;
  distributionCenterId: string;
  centerCode: string;
  requestedCenterName: string;
  requestedCenterAddress: string;
  requestedCallbackUrl: string;
  state: LinkRequestState;
  challengeExpiresAt: string;
  rejectionReason?: string;
  createdAt: string;
}

export type CenterLinkState =
  | 'pending'
  | 'approved'
  | 'active'
  | 'hibernating'
  | 'admin_locked'
  | 'rejected'
  | 'revoked';

export interface DistributionCenter {
  id: string;
  centerCode: string;
  name: string;
  address: string;
  callbackUrl: string;
  linkState: CenterLinkState;
  adminNote?: string;
  lastSeenAt?: string;
  hibernatedAt?: string;
  lockedAt?: string;
  lockReason?: string;
  lastInventorySyncAt?: string;
  lastInventorySyncStatus?: string;
}
