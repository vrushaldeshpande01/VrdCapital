import { brokerApi } from './client';

export interface BrokerCredential {
  id: string;
  client_id: string;
  broker: 'zerodha' | 'upstox' | 'angelone';
  account_id: string;
  display_name: string;
  is_sandbox: boolean;
  is_active: boolean;
  has_api_key: boolean;
  has_access_token: boolean;
  token_expiry: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  total_syncs: number;
  created_at: string;
}

export interface CredentialCreate {
  client_id: string;
  broker: string;
  account_id: string;
  display_name?: string;
  api_key?: string;
  api_secret?: string;
  is_sandbox: boolean;
}

export interface SyncLog {
  id: string;
  broker: string;
  sync_type: string;
  status: string;
  records_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
}

export interface SyncResult {
  client_id: string;
  credentials_synced: number;
  holdings_synced: number;
  prices_updated: number;
  errors: string[];
  duration_seconds: number;
}

export interface MarketQuote {
  symbol: string;
  exchange: string;
  ltp: number;
  open_price: number;
  high_price: number;
  low_price: number;
  prev_close: number;
  change: number;
  change_pct: number;
  volume: number;
}

export const brokerService = {
  // Credentials
  addCredential: (data: CredentialCreate) =>
    brokerApi.post<BrokerCredential>('/credentials', data),

  listCredentials: (clientId: string) =>
    brokerApi.get<BrokerCredential[]>(`/credentials/${clientId}`),

  updateCredential: (id: string, data: Partial<CredentialCreate> & { is_active?: boolean; access_token?: string }) =>
    brokerApi.patch<BrokerCredential>(`/credentials/${id}`, data),

  deleteCredential: (id: string) =>
    brokerApi.delete(`/credentials/${id}`),

  testConnection: (id: string) =>
    brokerApi.post<{ success: boolean; mode: string; message: string; profile?: any }>(`/credentials/${id}/test`),

  // Sync
  triggerSync: (clientId: string) =>
    brokerApi.post<SyncResult>(`/sync/${clientId}`, { sync_type: 'full' }),

  getSyncLogs: (clientId: string) =>
    brokerApi.get<SyncLog[]>(`/sync/${clientId}/logs`),

  // Market data
  getQuote: (symbol: string) =>
    brokerApi.get<MarketQuote>(`/market/quote/${symbol}`),

  searchSymbols: (q: string) =>
    brokerApi.get<{ results: any[] }>(`/market/search?q=${q}`),

  getAllSymbols: () =>
    brokerApi.get<{ symbols: any[] }>('/market/nse/all'),
};
