export interface Customer {
  id: string;
  email: string;
  name: string;
  token: string;
  workosUserId: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  customer: Customer;
}

export interface MagicLinkResponse {
  status: string;
}

export interface AuthCallbackResponse {
  token: string;
  userId: string;
  customer: Customer;
}
