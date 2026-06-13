import { orderApi } from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export type PriceType    = 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';
export type ProductType  = 'CNC' | 'MIS' | 'NRML';
export type OrderSide    = 'BUY' | 'SELL';
export type Validity     = 'DAY' | 'IOC' | 'TTL';
export type InstrumentType = 'EQUITY' | 'FUTURES' | 'OPTIONS' | 'CURRENCY';

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  instrument_type: InstrumentType;
  lot_size: number;
  tick_size: string;
  ltp: string;
}

export interface TradingOrder {
  id: string;
  client_id: string;
  broker: string;
  managed_by: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  price_type: PriceType;
  product_type: ProductType;
  validity: Validity;
  quantity: number;
  price: string | null;
  trigger_price: string | null;
  tag: string | null;
  status: string;
  broker_order_id: string | null;
  executed_quantity: number;
  average_price: string | null;
  rejection_reason: string | null;
  placed_at: string;
  executed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface PlaceOrderPayload {
  client_id: string;
  broker?: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  price_type: PriceType;
  product_type: ProductType;
  validity: Validity;
  quantity: number;
  price?: string | null;
  trigger_price?: string | null;
  tag?: string;
}

export interface Trade {
  id: string;
  order_id: string;
  client_id: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  fill_qty: number;
  fill_price: string;
  product_type: ProductType;
  traded_at: string;
}

export interface TradingPosition {
  symbol: string;
  exchange: string;
  product_type: string;
  buy_qty: number;
  sell_qty: number;
  net_qty: number;
  avg_buy_price: string;
  avg_sell_price: string;
  ltp: string;
  unrealized_pnl: string;
  realized_pnl: string;
  is_open: boolean;
}

export interface TradingHolding {
  symbol: string;
  exchange: string;
  quantity: number;
  avg_buy_price: string;
  current_value: string;
  invested_value: string;
  pnl: string;
  pnl_pct: string;
  ltp: string;
}

export interface ClientFund {
  id: string;
  client_id: string;
  available: string;
  used: string;
  total: string;
}

// ── Service ────────────────────────────────────────────────────────────────

export const tradingService = {
  // Instruments
  searchInstruments: (q: string, exchange?: string) =>
    orderApi.get<Instrument[]>('/instruments', { params: { q, exchange } }),

  getInstrument: (id: string) =>
    orderApi.get<Instrument>(`/instruments/${id}`),

  setLtp: (symbol: string, price: number) =>
    orderApi.patch(`/instruments/${symbol}/ltp`, { price }),

  // Orders
  placeOrder: (payload: PlaceOrderPayload) =>
    orderApi.post<TradingOrder>('/orders', payload),

  listOrders: (params?: {
    client_id?: string; status?: string; symbol?: string;
    page?: number; size?: number;
  }) => orderApi.get<{ items: TradingOrder[]; total: number; page: number; size: number; pages: number }>(
    '/orders', { params }
  ),

  modifyOrder: (id: string, body: { quantity?: number; price?: string; trigger_price?: string; validity?: string }) =>
    orderApi.patch<TradingOrder>(`/orders/${id}`, body),

  cancelOrder: (id: string, reason?: string) =>
    orderApi.patch<TradingOrder>(`/orders/${id}/cancel`, { reason }),

  forceExecute: (id: string) =>
    orderApi.post<TradingOrder>(`/orders/${id}/execute`, {}),

  // Trades
  listTrades: (params?: { client_id?: string; symbol?: string; page?: number; size?: number }) =>
    orderApi.get<Trade[]>('/trades', { params }),

  // Positions
  getPositions: (client_id: string, type: 'day' | 'net' = 'day') =>
    orderApi.get<TradingPosition[]>('/trading/positions', { params: { client_id, type } }),

  // Holdings
  getHoldings: (client_id: string) =>
    orderApi.get<TradingHolding[]>('/trading/holdings', { params: { client_id } }),

  // Funds
  getFunds: (client_id: string) =>
    orderApi.get<ClientFund>(`/funds/${client_id}`),

  setFunds: (client_id: string, available: number, total: number) =>
    orderApi.put<ClientFund>(`/funds/${client_id}`, { available, total }),
};
