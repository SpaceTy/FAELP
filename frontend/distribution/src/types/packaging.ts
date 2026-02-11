export type PackagingStatus = 'to_package' | 'in_progress' | 'ready' | 'shipped';
export type PackageSize = 'small' | 'medium' | 'large' | 'pallet';

export interface PackageItem {
  materialTypeId: string;
  materialName: string;
  quantity: number;
  location: string;
  isPacked: boolean;
}

export interface PackagingOrder {
  id: string;
  requestId: string;
  recipientName: string;
  recipientOrg: string;
  recipientAddress: string[];
  items: PackageItem[];
  status: PackagingStatus;
  packageSize: PackageSize;
  shipByDate: string;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackagingStats {
  toPackage: number;
  inProgress: number;
  ready: number;
  shippedToday: number;
}

export interface ListPackagingParams {
  status?: PackagingStatus | '';
  dateRange?: 'today' | 'tomorrow' | 'week' | 'nextWeek' | '';
  packageSize?: PackageSize | '';
}

export interface MarkPackedInput {
  orderId: string;
  itemIndex: number;
  packed: boolean;
}

export interface MarkShippedInput {
  orderId: string;
  trackingNumber: string;
}
