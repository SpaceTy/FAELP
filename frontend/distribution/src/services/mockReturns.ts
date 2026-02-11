import type {
  ReturnRecord,
  ReturnStats,
  ListReturnsParams,
  InspectItemInput,
  CompleteReturnInput,
} from '@/types/returns';

const mockReturns: ReturnRecord[] = [
  {
    id: 'RET-2026-0031',
    requestId: 'REQ-2026-0042',
    borrowerName: 'Sarah Lehmann',
    borrowerOrg: 'Red Cross Training',
    borrowerEmail: 'sarah.lehmann@redcross.de',
    borrowerPhone: '+49 30 11223344',
    items: [
      { materialTypeId: 'mini-anne', materialName: 'Mini Anne einzeln', quantity: 3, unitId: 'Unit #12', condition: 'good', destination: 'inventory', location: 'Shelf A-10', isInspected: true, returnToInventory: true },
      { materialTypeId: 'mini-anne', materialName: 'Mini Anne einzeln', quantity: 1, unitId: 'Unit #13', condition: 'good', destination: 'inventory', location: 'Shelf A-10', isInspected: true, returnToInventory: true },
      { materialTypeId: 'mini-anne', materialName: 'Mini Anne einzeln', quantity: 1, unitId: 'Unit #14', condition: 'fair', destination: 'cleaning', location: 'Shelf A-10', isInspected: true, returnToInventory: true },
      { materialTypeId: 'mini-anne', materialName: 'Mini Anne einzeln', quantity: 1, unitId: 'Unit #15', condition: 'damaged', destination: 'repair', location: 'Shelf A-10', isInspected: true, returnToInventory: false },
    ],
    status: 'inspection',
    sentDate: '2026-01-05',
    dueDate: '2026-01-19',
    receivedDate: '2026-01-19',
    purpose: 'Training Session',
    createdAt: '2026-01-05T09:00:00Z',
    updatedAt: '2026-01-19T14:30:00Z',
  },
  {
    id: 'RET-2026-0022',
    requestId: 'REQ-2026-0033',
    borrowerName: 'Max Richter',
    borrowerOrg: 'Sports Club Munich',
    borrowerEmail: 'max.richter@sportsclub.de',
    borrowerPhone: '+49 89 1234567',
    items: [
      { materialTypeId: 'triangle-001', materialName: 'Dreieckstuch', quantity: 10, condition: 'good', destination: 'inventory', isInspected: false, returnToInventory: true },
      { materialTypeId: 'blanket-001', materialName: 'Rettungsdecke', quantity: 5, condition: 'good', destination: 'inventory', isInspected: false, returnToInventory: true },
      { materialTypeId: 'manikin-001', materialName: 'QCPR Little Anne', quantity: 2, condition: 'excellent', destination: 'inventory', isInspected: false, returnToInventory: true },
    ],
    status: 'awaiting',
    sentDate: '2025-12-28',
    dueDate: '2026-01-11',
    purpose: 'Training Session',
    createdAt: '2025-12-28T10:00:00Z',
    updatedAt: '2026-01-11T00:00:00Z',
  },
  {
    id: 'RET-2026-0030',
    requestId: 'REQ-2026-0041',
    borrowerName: 'Anna Schmidt',
    borrowerOrg: 'Company First Aid',
    borrowerEmail: 'anna.schmidt@company.de',
    borrowerPhone: '+49 40 9876543',
    items: [
      { materialTypeId: 'aed-001', materialName: 'AED Trainer', quantity: 1, condition: 'excellent', destination: 'inventory', isInspected: true, returnToInventory: true },
      { materialTypeId: 'manikin-002', materialName: 'QCPR Junior Puppe', quantity: 2, condition: 'good', destination: 'inventory', isInspected: true, returnToInventory: true },
      { materialTypeId: 'mat-001', materialName: 'Apollo Uebungsmatte', quantity: 5, condition: 'fair', destination: 'cleaning', isInspected: true, returnToInventory: true },
    ],
    status: 'completed',
    sentDate: '2026-01-02',
    dueDate: '2026-01-16',
    receivedDate: '2026-01-16',
    purpose: 'Employee Training',
    createdAt: '2026-01-02T08:00:00Z',
    updatedAt: '2026-01-16T11:00:00Z',
  },
  {
    id: 'RET-2026-0029',
    requestId: 'REQ-2026-0040',
    borrowerName: 'Peter Mueller',
    borrowerOrg: 'School District',
    borrowerEmail: 'p.mueller@schools.de',
    borrowerPhone: '+49 89 5566778',
    items: [
      { materialTypeId: 'mini-anne', materialName: 'Mini Anne', quantity: 15, condition: 'good', destination: 'inventory', isInspected: true, returnToInventory: true },
      { materialTypeId: 'mini-anne', materialName: 'Mini Anne', quantity: 5, condition: 'fair', destination: 'cleaning', isInspected: true, returnToInventory: true },
    ],
    status: 'received',
    sentDate: '2026-01-08',
    dueDate: '2026-01-22',
    receivedDate: '2026-01-19',
    purpose: 'Student Training',
    createdAt: '2026-01-08T09:00:00Z',
    updatedAt: '2026-01-19T10:00:00Z',
  },
  {
    id: 'RET-2026-0028',
    requestId: 'REQ-2026-0038',
    borrowerName: 'Klaus Weber',
    borrowerOrg: 'Community Center',
    borrowerEmail: 'klaus@community.de',
    borrowerPhone: '+49 221 3344556',
    items: [
      { materialTypeId: 'family-set', materialName: 'Laerdal Family Satz', quantity: 1, condition: 'excellent', destination: 'inventory', isInspected: true, returnToInventory: true },
      { materialTypeId: 'wound-kit', materialName: 'Wound Care Kit', quantity: 2, condition: 'damaged', destination: 'repair', isInspected: true, returnToInventory: false },
    ],
    status: 'inspection',
    sentDate: '2026-01-04',
    dueDate: '2026-01-18',
    receivedDate: '2026-01-18',
    purpose: 'Public Workshop',
    createdAt: '2026-01-04T11:00:00Z',
    updatedAt: '2026-01-18T15:00:00Z',
  },
  {
    id: 'RET-2026-0027',
    requestId: 'REQ-2026-0035',
    borrowerName: 'Lisa Fischer',
    borrowerOrg: 'Hospital Training',
    borrowerEmail: 'lisa.fischer@hospital.de',
    borrowerPhone: '+49 69 7788990',
    items: [
      { materialTypeId: 'trauma-kit', materialName: 'Trauma Kit', quantity: 3, condition: 'excellent', destination: 'inventory', isInspected: true, returnToInventory: true },
    ],
    status: 'completed',
    sentDate: '2025-12-20',
    dueDate: '2026-01-10',
    receivedDate: '2026-01-09',
    purpose: 'Medical Training',
    createdAt: '2025-12-20T08:00:00Z',
    updatedAt: '2026-01-09T12:00:00Z',
  },
];

class MockReturnsService {
  async listReturns(params: ListReturnsParams = {}): Promise<ReturnRecord[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    let filtered = [...mockReturns];

    if (params.status) {
      filtered = filtered.filter((r) => r.status === params.status);
    }

    if (params.dueDate) {
      const now = new Date('2026-01-19');
      filtered = filtered.filter((r) => {
        const due = new Date(r.dueDate);
        const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0 && r.status !== 'completed';

        switch (params.dueDate) {
          case 'overdue':
            return isOverdue;
          case 'today':
            return diffDays === 0;
          case 'week':
            return diffDays >= 0 && diffDays <= 7;
          case 'later':
            return diffDays > 7;
          default:
            return true;
        }
      });
    }

    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getReturnStats(): Promise<ReturnStats> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const now = new Date('2026-01-19');

    return {
      overdue: mockReturns.filter((r) => {
        const due = new Date(r.dueDate);
        return due < now && r.status !== 'completed';
      }).length,
      dueToday: mockReturns.filter((r) => {
        const due = new Date(r.dueDate);
        return due.toDateString() === now.toDateString() && r.status !== 'completed';
      }).length,
      toInspect: mockReturns.filter((r) => r.status === 'received' || r.status === 'inspection').length,
      completedToday: 6, // Mock constant
    };
  }

  async inspectItem(input: InspectItemInput): Promise<ReturnRecord> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const returnRecord = mockReturns.find((r) => r.id === input.returnId);
    if (!returnRecord) {
      throw new Error('Return not found');
    }

    const item = returnRecord.items[input.itemIndex];
    if (item) {
      item.condition = input.condition;
      item.destination = input.destination;
      item.returnToInventory = input.returnToInventory;
      item.isInspected = true;
    }

    // Update status if all items inspected
    const allInspected = returnRecord.items.every((i) => i.isInspected);
    if (allInspected && returnRecord.status === 'received') {
      returnRecord.status = 'inspection';
    }

    returnRecord.updatedAt = new Date().toISOString();
    return returnRecord;
  }

  async completeReturn(input: CompleteReturnInput): Promise<ReturnRecord> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const returnRecord = mockReturns.find((r) => r.id === input.returnId);
    if (!returnRecord) {
      throw new Error('Return not found');
    }

    returnRecord.status = 'completed';
    returnRecord.updatedAt = new Date().toISOString();
    return returnRecord;
  }
}

export const mockReturnsService = new MockReturnsService();
