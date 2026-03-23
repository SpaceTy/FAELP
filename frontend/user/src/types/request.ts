export interface RequestItem {
  materialTypeId: string;
  quantity: number;
}

export interface Request {
  id: string;
  customerId: string;
  deliveryDate: string;
  plannedReturnDate?: string;
  intendedStudents: number;
  status: 'pending' | 'approved' | 'inAction' | 'returned' | 'cancelled';
  outgoingTrackingCode?: string;
  shippingName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  zipCode: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  items: RequestItem[];
}

export interface CreateRequestInput {
  deliveryDate: string;
  plannedReturnDate: string;
  intendedStudents: number;
  dataProcessingConsent: boolean;
  shareIntendedStudents: boolean;
  shippingName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  zipCode: string;
  note?: string;
  items: RequestItem[];
}
