// Auth types for distribution admin frontend - matching backend API

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  message: string;
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
