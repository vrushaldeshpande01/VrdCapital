import { authApi } from './client';
import type { User } from '@/types';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export const authService = {
  login: async (payload: LoginPayload): Promise<TokenResponse> => {
    const { data } = await authApi.post<TokenResponse>('/auth/login', payload);
    return data;
  },

  logout: async (refresh_token: string): Promise<void> => {
    await authApi.post('/auth/logout', { refresh_token });
  },

  getMe: async (): Promise<User> => {
    const { data } = await authApi.get<User>('/auth/me');
    return data;
  },

  changePassword: async (payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> => {
    await authApi.post('/auth/change-password', payload);
  },
};
