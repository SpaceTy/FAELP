import type {
  PackagingOrder,
  PackagingStats,
  ListPackagingParams,
  MarkPackedInput,
  MarkShippedInput,
} from '@/types/packaging';

const mockOrders: PackagingOrder[] = [
  {
    id: 'PACK-2026-0048',
    requestId: 'REQ-2026-0055',
    recipientName: 'Maria Schmidt',
    recipientOrg: 'Company Safety Team',
    recipientAddress: ['Company Training Center', 'Hauptstrasse 123', '10115 Berlin'],
    items: [
      { materialTypeId: 'family-set', materialName: 'Laerdal Family Satz', quantity: 1, location: 'Shelf A-12', isPacked: false },
      { materialTypeId: 'mat-001', materialName: 'Apollo Uebungsmatte', quantity: 10, location: 'Shelf C-03', isPacked: false },
    ],
    status: 'to_package',
    packageSize: 'large',
    shipByDate: '2026-01-19',
    createdAt: '2026-01-18T13:30:00Z',
    updatedAt: '2026-01-18T13:30:00Z',
  },
  {
    id: 'PACK-2026-0047',
    requestId: 'REQ-2026-0054',
    recipientName: 'Peter Johnson',
    recipientOrg: 'Fire Department',
    recipientAddress: ['Fire Station 3', 'Feuerwehrstrasse 5', '22111 Hamburg'],
    items: [
      { materialTypeId: 'trauma-kit', materialName: 'Trauma Kit', quantity: 3, location: 'Shelf B-15', isPacked: true },
    ],
    status: 'ready',
    packageSize: 'medium',
    shipByDate: '2026-01-19',
    trackingNumber: '1Z999AA10123456784',
    createdAt: '2026-01-17T17:00:00Z',
    updatedAt: '2026-01-18T09:00:00Z',
  },
  {
    id: 'PACK-2026-0046',
    requestId: 'REQ-2026-0052',
    recipientName: 'John Doe',
    recipientOrg: 'Community Center',
    recipientAddress: ['Community Center', 'Dorfplatz 1', '14199 Berlin'],
    items: [
      { materialTypeId: 'aed-001', materialName: 'AED Trainer', quantity: 1, location: 'Shelf A-08', isPacked: false },
      { materialTypeId: 'manikin-002', materialName: 'QCPR Junior Puppe', quantity: 2, location: 'Shelf A-05', isPacked: true },
    ],
    status: 'in_progress',
    packageSize: 'medium',
    shipByDate: '2026-01-20',
    createdAt: '2026-01-19T08:30:00Z',
    updatedAt: '2026-01-19T10:00:00Z',
  },
  {
    id: 'PACK-2026-0045',
    requestId: 'REQ-2026-0058',
    recipientName: 'Thomas Weber',
    recipientOrg: 'Red Cross Berlin',
    recipientAddress: ['Red Cross Center', 'Friedrichstrasse 100', '10117 Berlin'],
    items: [
      { materialTypeId: 'tourniquet-001', materialName: 'Tourniquet', quantity: 5, location: 'Shelf D-02', isPacked: false },
      { materialTypeId: 'bandage-001', materialName: 'Fixierbinde', quantity: 10, location: 'Shelf D-05', isPacked: false },
      { materialTypeId: 'compress-001', materialName: 'Sterile Kompressen', quantity: 20, location: 'Shelf D-08', isPacked: false },
    ],
    status: 'to_package',
    packageSize: 'medium',
    shipByDate: '2026-01-20',
    createdAt: '2026-01-19T10:30:00Z',
    updatedAt: '2026-01-19T10:30:00Z',
  },
  {
    id: 'PACK-2026-0044',
    requestId: 'REQ-2026-0057',
    recipientName: 'Sarah Mueller',
    recipientOrg: 'Hospital Training Dept',
    recipientAddress: ['Charité Campus', 'Building 4', '10117 Berlin'],
    items: [
      { materialTypeId: 'aed-001', materialName: 'AED Trainer', quantity: 2, location: 'Shelf A-08', isPacked: true },
      { materialTypeId: 'manikin-001', materialName: 'QCPR Little Anne', quantity: 5, location: 'Shelf A-02', isPacked: true },
    ],
    status: 'ready',
    packageSize: 'large',
    shipByDate: '2026-01-21',
    createdAt: '2026-01-19T09:15:00Z',
    updatedAt: '2026-01-19T11:00:00Z',
  },
  {
    id: 'PACK-2026-0043',
    requestId: 'REQ-2026-0056',
    recipientName: 'Klaus Becker',
    recipientOrg: 'Sports Club Munich',
    recipientAddress: ['Sports Club Munich', 'Olympiapark 1', '80809 Munich'],
    items: [
      { materialTypeId: 'triangle-001', materialName: 'Dreieckstuch', quantity: 10, location: 'Shelf E-01', isPacked: false },
      { materialTypeId: 'blanket-001', materialName: 'Rettungsdecke', quantity: 5, location: 'Shelf E-03', isPacked: false },
    ],
    status: 'to_package',
    packageSize: 'small',
    shipByDate: '2026-01-22',
    createdAt: '2026-01-18T14:20:00Z',
    updatedAt: '2026-01-18T14:20:00Z',
  },
  {
    id: 'PACK-2026-0042',
    requestId: 'REQ-2026-0051',
    recipientName: 'Lisa Wagner',
    recipientOrg: 'Nursing School',
    recipientAddress: ['Nursing School', 'Gesundheitsstrasse 10', '60313 Frankfurt'],
    items: [
      { materialTypeId: 'wound-kit', materialName: 'Wound Care Kit', quantity: 5, location: 'Shelf F-01', isPacked: true },
      { materialTypeId: 'bandage-002', materialName: 'Elastische Binde', quantity: 15, location: 'Shelf F-03', isPacked: false },
    ],
    status: 'in_progress',
    packageSize: 'medium',
    shipByDate: '2026-01-21',
    createdAt: '2026-01-19T07:00:00Z',
    updatedAt: '2026-01-19T08:30:00Z',
  },
];

class MockPackagingService {
  async listOrders(params: ListPackagingParams = {}): Promise<PackagingOrder[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    let filtered = [...mockOrders];

    if (params.status) {
      filtered = filtered.filter((o) => o.status === params.status);
    }

    if (params.packageSize) {
      filtered = filtered.filter((o) => o.packageSize === params.packageSize);
    }

    if (params.dateRange) {
      const now = new Date('2026-01-19');
      filtered = filtered.filter((o) => {
        const shipDate = new Date(o.shipByDate);
        const diffDays = Math.floor((shipDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        switch (params.dateRange) {
          case 'today':
            return diffDays === 0;
          case 'tomorrow':
            return diffDays === 1;
          case 'week':
            return diffDays >= 0 && diffDays <= 7;
          case 'nextWeek':
            return diffDays > 7 && diffDays <= 14;
          default:
            return true;
        }
      });
    }

    return filtered.sort((a, b) => new Date(a.shipByDate).getTime() - new Date(b.shipByDate).getTime());
  }

  async getPackagingStats(): Promise<PackagingStats> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    return {
      toPackage: mockOrders.filter((o) => o.status === 'to_package').length,
      inProgress: mockOrders.filter((o) => o.status === 'in_progress').length,
      ready: mockOrders.filter((o) => o.status === 'ready').length,
      shippedToday: 8, // Mock constant
    };
  }

  async markItemPacked(input: MarkPackedInput): Promise<PackagingOrder> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const order = mockOrders.find((o) => o.id === input.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.items[input.itemIndex]) {
      order.items[input.itemIndex].isPacked = input.packed;
    }

    // Auto-update status based on packing progress
    const allPacked = order.items.every((item) => item.isPacked);
    if (allPacked && order.status === 'to_package') {
      order.status = 'ready';
    } else if (!allPacked && order.status === 'ready') {
      order.status = 'in_progress';
    }

    order.updatedAt = new Date().toISOString();
    return order;
  }

  async markShipped(input: MarkShippedInput): Promise<PackagingOrder> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const order = mockOrders.find((o) => o.id === input.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    order.status = 'shipped';
    order.trackingNumber = input.trackingNumber;
    order.updatedAt = new Date().toISOString();
    return order;
  }
}

export const mockPackagingService = new MockPackagingService();
