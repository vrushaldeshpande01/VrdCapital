import { clientApi } from './client';
import type { Client, PaginatedResponse } from '@/types';

export interface ClientFilters {
  page?: number;
  size?: number;
  status?: string;
  search?: string;
}

export interface CreateClientPayload {
  full_name: string;
  email: string;
  phone: string;
  pan_number?: string;
  risk_profile?: string;
  annual_income?: number;
  investment_goal?: string;
  investment_horizon_years?: number;
  notes?: string;
}

export interface ClientStats {
  total_clients: number;
  active_clients: number;
  inactive_clients: number;
  kyc_verified: number;
  kyc_pending: number;
}

export const clientsService = {
  list: async (filters: ClientFilters = {}): Promise<PaginatedResponse<Client>> => {
    const { data } = await clientApi.get<PaginatedResponse<Client>>('/clients', { params: filters });
    return data;
  },

  get: async (id: string): Promise<Client> => {
    const { data } = await clientApi.get<Client>(`/clients/${id}`);
    return data;
  },

  create: async (payload: CreateClientPayload): Promise<Client> => {
    const { data } = await clientApi.post<Client>('/clients', payload);
    return data;
  },

  update: async (id: string, payload: Partial<CreateClientPayload>): Promise<Client> => {
    const { data } = await clientApi.patch<Client>(`/clients/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await clientApi.delete(`/clients/${id}`);
  },

  getStats: async (): Promise<ClientStats> => {
    const { data } = await clientApi.get<ClientStats>('/clients/stats');
    return data;
  },

  addBrokerAccount: async (clientId: string, payload: {
    broker: string;
    account_id: string;
    account_name?: string;
    api_key?: string;
    api_secret?: string;
    is_primary?: boolean;
  }) => {
    const { data } = await clientApi.post(`/clients/${clientId}/broker-accounts`, payload);
    return data;
  },

  removeBrokerAccount: async (clientId: string, accountId: string): Promise<void> => {
    await clientApi.delete(`/clients/${clientId}/broker-accounts/${accountId}`);
  },
};
