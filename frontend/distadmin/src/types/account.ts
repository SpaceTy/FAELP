// User types for distribution admin frontend - matching backend API
// Note: The backend uses "users" terminology, not "accounts"

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  isAdmin: boolean;
}

export interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordInput {
  newPassword: string;
}

export interface SetAdminInput {
  isAdmin: boolean;
}

// Re-export from auth.ts for backwards compatibility
export type { User as Account, CreateUserInput as CreateAccountInput };
