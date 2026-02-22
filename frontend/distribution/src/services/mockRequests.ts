import type {
  BorrowRequest,
  RequestStats,
  ListRequestsParams,
  ApproveRequestInput,
  RejectRequestInput,
} from '@/types/requests';

// Mock data for requests
const mockRequests: BorrowRequest[] = [
  {
    id: 'REQ-2026-0058',
    requesterName: 'Thomas Weber',
    requesterOrg: 'Red Cross Berlin',
    requesterEmail: 'thomas.weber@redcross.de',
    requesterPhone: '+49 30 12345678',
    intendedStudents: 30,
    items: [
      { materialTypeId: 'tourniquet-001', materialName: 'Tourniquet', quantity: 5 },
      { materialTypeId: 'bandage-001', materialName: 'Fixierbinde', quantity: 10 },
      { materialTypeId: 'compress-001', materialName: 'Sterile Kompressen', quantity: 20 },
    ],
    purpose: 'Training Session',
    requestedFor: '2026-01-25',
    priority: 'high',
    status: 'pending',
    archived: false,
    createdAt: '2026-01-19T10:30:00Z',
    updatedAt: '2026-01-19T10:30:00Z',
  },
  {
    id: 'REQ-2026-0057',
    requesterName: 'Sarah Mueller',
    requesterOrg: 'Hospital Training Dept',
    requesterEmail: 's.mueller@hospital.de',
    requesterPhone: '+49 30 87654321',
    intendedStudents: 18,
    items: [
      { materialTypeId: 'aed-001', materialName: 'AED Trainer', quantity: 2 },
      { materialTypeId: 'manikin-001', materialName: 'QCPR Little Anne', quantity: 5 },
    ],
    purpose: 'CPR Certification Course',
    requestedFor: '2026-01-22',
    priority: 'normal',
    status: 'pending',
    archived: false,
    createdAt: '2026-01-19T09:15:00Z',
    updatedAt: '2026-01-19T09:15:00Z',
  },
  {
    id: 'REQ-2026-0056',
    requesterName: 'Klaus Becker',
    requesterOrg: 'Sports Club Munich',
    requesterEmail: 'klaus@sportsclub.de',
    requesterPhone: '+49 89 1234567',
    intendedStudents: 24,
    items: [
      { materialTypeId: 'triangle-001', materialName: 'Dreieckstuch', quantity: 10 },
      { materialTypeId: 'blanket-001', materialName: 'Rettungsdecke', quantity: 5 },
    ],
    purpose: 'First Aid Workshop',
    requestedFor: '2026-01-28',
    priority: 'low',
    status: 'pending',
    archived: false,
    createdAt: '2026-01-18T14:20:00Z',
    updatedAt: '2026-01-18T14:20:00Z',
  },
  {
    id: 'REQ-2026-0055',
    requesterName: 'Maria Schmidt',
    requesterOrg: 'Company Safety Team',
    requesterEmail: 'maria.schmidt@company.de',
    requesterPhone: '+49 40 98765432',
    intendedStudents: 15,
    items: [
      { materialTypeId: 'family-set', materialName: 'Laerdal Family Satz', quantity: 1 },
      { materialTypeId: 'mat-001', materialName: 'Apollo Uebungsmatte', quantity: 10 },
    ],
    purpose: 'Employee Training',
    requestedFor: '2026-01-23',
    priority: 'high',
    status: 'inAction',
    archived: false,
    createdAt: '2026-01-18T11:00:00Z',
    updatedAt: '2026-01-18T13:30:00Z',
  },
  {
    id: 'REQ-2026-0054',
    requesterName: 'Peter Johnson',
    requesterOrg: 'Fire Department',
    requesterEmail: 'p.johnson@fire.de',
    requesterPhone: '+49 221 11223344',
    intendedStudents: 12,
    items: [
      { materialTypeId: 'trauma-kit', materialName: 'Trauma Kit', quantity: 3 },
    ],
    purpose: 'Emergency Training',
    requestedFor: '2026-01-20',
    priority: 'high',
    status: 'inAction',
    archived: false,
    createdAt: '2026-01-17T16:45:00Z',
    updatedAt: '2026-01-17T17:00:00Z',
  },
  {
    id: 'REQ-2026-0053',
    requesterName: 'Anna Fischer',
    requesterOrg: 'School District',
    requesterEmail: 'anna.fischer@schools.de',
    requesterPhone: '+49 89 55667788',
    intendedStudents: 40,
    items: [
      { materialTypeId: 'mini-anne', materialName: 'Mini Anne', quantity: 20 },
    ],
    purpose: 'Student Training',
    requestedFor: '2026-02-01',
    priority: 'normal',
    status: 'returned',
    archived: false,
    createdAt: '2026-01-16T09:00:00Z',
    updatedAt: '2026-01-16T10:15:00Z',
  },
  {
    id: 'REQ-2026-0052',
    requesterName: 'John Doe',
    requesterOrg: 'Community Center',
    requesterEmail: 'john@community.de',
    requesterPhone: '+49 30 33445566',
    intendedStudents: 10,
    items: [
      { materialTypeId: 'aed-001', materialName: 'AED Trainer', quantity: 1 },
      { materialTypeId: 'manikin-002', materialName: 'QCPR Junior Puppe', quantity: 2 },
    ],
    purpose: 'Public Workshop',
    requestedFor: '2026-01-24',
    priority: 'normal',
    status: 'pending',
    archived: false,
    createdAt: '2026-01-19T08:30:00Z',
    updatedAt: '2026-01-19T08:30:00Z',
  },
  {
    id: 'REQ-2026-0051',
    requesterName: 'Lisa Wagner',
    requesterOrg: 'Nursing School',
    requesterEmail: 'lisa.wagner@nursing.de',
    requesterPhone: '+49 69 77889900',
    intendedStudents: 22,
    items: [
      { materialTypeId: 'wound-kit', materialName: 'Wound Care Kit', quantity: 5 },
      { materialTypeId: 'bandage-002', materialName: 'Elastische Binde', quantity: 15 },
    ],
    purpose: 'Practical Exam',
    requestedFor: '2026-01-21',
    priority: 'high',
    status: 'pending',
    archived: false,
    createdAt: '2026-01-19T07:00:00Z',
    updatedAt: '2026-01-19T07:00:00Z',
  },
];

class MockRequestsService {
  async listRequests(params: ListRequestsParams = {}): Promise<BorrowRequest[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    let filtered = [...mockRequests];

    if (params.status) {
      filtered = filtered.filter((r) => r.status === params.status);
    }

    if (params.priority) {
      filtered = filtered.filter((r) => r.priority === params.priority);
    }

    if (params.dateRange) {
      const now = new Date('2026-01-19'); // Mock current date
      filtered = filtered.filter((r) => {
        const created = new Date(r.createdAt);
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (params.dateRange) {
          case 'today':
            return diffDays === 0;
          case 'week':
            return diffDays <= 7;
          case 'older':
            return diffDays > 7;
          default:
            return true;
        }
      });
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRequestStats(): Promise<RequestStats> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    return {
      pending: mockRequests.filter((r) => r.status === 'pending').length,
      approved: mockRequests.filter((r) => r.status === 'approved').length,
      inAction: mockRequests.filter((r) => r.status === 'inAction').length,
      returned: mockRequests.filter((r) => r.status === 'returned').length,
      cancelled: mockRequests.filter((r) => r.status === 'cancelled').length,
      archived: mockRequests.filter((r) => r.archived).length,
      total: mockRequests.length,
    };
  }

  async approveRequest(input: ApproveRequestInput): Promise<BorrowRequest> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    const request = mockRequests.find((r) => r.id === input.requestId);
    if (!request) {
      throw new Error('Request not found');
    }
    
    request.status = 'inAction';
    request.updatedAt = new Date().toISOString();
    return request;
  }

  async rejectRequest(input: RejectRequestInput): Promise<BorrowRequest> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    const request = mockRequests.find((r) => r.id === input.requestId);
    if (!request) {
      throw new Error('Request not found');
    }
    
    request.status = 'returned';
    request.updatedAt = new Date().toISOString();
    return request;
  }
}

export const mockRequestsService = new MockRequestsService();
