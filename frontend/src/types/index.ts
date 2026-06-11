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

// ── Portfolio types ───────────────────────────────────────────────────────────

export type AssetClass = 'equity' | 'mutual_fund' | 'etf' | 'bond' | 'cash' | 'other';
export type Exchange = 'NSE' | 'BSE';
export type HoldingStatus = 'active' | 'closed';

export interface Holding {
  id: string;
  client_id: string;
  broker_account_id: string;
  symbol: string;
  isin: string | null;
  name: string | null;
  exchange: Exchange;
  asset_class: AssetClass;
  sector: string | null;
  quantity: number;
  average_buy_price: number;
  current_price: number | null;
  previous_close: number | null;
  invested_value: number | null;
  current_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  day_pnl: number | null;
  status: HoldingStatus;
  last_price_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  weight_pct: number;
}

export interface TopHolding {
  symbol: string;
  name: string | null;
  sector: string | null;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  weight_pct: number;
}

export interface PortfolioSummary {
  client_id: string;
  holdings_value: number;
  invested_value: number;
  cash_balance: number;
  total_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number | null;
  day_pnl: number;
  day_return_pct: number | null;
  total_holdings: number;
  sector_allocation: SectorAllocation[];
  top_holdings: TopHolding[];
}

export interface AUMSummary {
  total_aum: number;
  total_clients: number;
  total_holdings_value: number;
  total_cash: number;
  total_invested: number;
  total_unrealized_pnl: number;
  total_day_pnl: number;
  day_return_pct: number | null;
}

export interface PortfolioSnapshot {
  snapshot_date: string;
  total_value: number;
  holdings_value: number;
  cash_balance: number;
  day_pnl: number | null;
  day_return_pct: number | null;
  total_pnl: number | null;
  total_return_pct: number | null;
}
