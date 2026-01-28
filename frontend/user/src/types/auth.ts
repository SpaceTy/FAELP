export interface Customer {
  id: string;
  email: string;
  name: string;
  workosUserId: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  customer: Customer;
}
