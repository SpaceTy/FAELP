export interface UserRecord {
  id: string;
  email: string;
  name: string;
  workosUserId: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export interface UserImportResult {
  users: UserRecord[];
  newlyVerifiedUsers: UserRecord[];
  createdCount: number;
  verifiedCount: number;
  alreadyVerifiedCount: number;
  invalidEmails: string[];
}
