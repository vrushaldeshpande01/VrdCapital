export type UserRole = 'admin' | 'portfolio_manager' | 'client';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type ClientStatus = 'active' | 'inactive' | 'suspended' | 'onboarding';
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';
export type BrokerName = 'zerodha' | 'upstox' | 'angelone';
export type AccountStatus = 'active' | 'inactive' | 'expired' | 'revoked';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_superuser: boolean;
}

export interface AuthState {
  user: User | null;
  access_token: string | null;
  refresh_token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface BrokerAccount {
  id: string;
  client_id: string;
  broker: BrokerName;
  account_id: string;
  account_name: string | null;
  status: AccountStatus;
  is_primary: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string | null;
  managed_by: string;
  full_name: string;
  email: string;
  phone: string;
  pan_number: string | null;
  date_of_birth: string | null;
  city: string | null;
  state: string | null;
  country: string;
  annual_income: number | null;
  investment_goal: string | null;
  risk_profile: RiskProfile;
  investment_horizon_years: number | null;
  status: ClientStatus;
  kyc_verified: boolean;
  kyc_verified_at: string | null;
  notes: string | null;
  tags: string | null;
  broker_accounts: BrokerAccount[];
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}
