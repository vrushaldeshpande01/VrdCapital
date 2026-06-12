import { orderApi } from './client';

export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'OPEN' | 'EXECUTED' | 'PARTIALLY_EXECUTED' | 'CANCELLED' | 'REJECTED' | 'FAILED';
export type OrderSide = 'BUY' | 'SELL';
export type PriceType = 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';

export interface Order {
  id: string;
  client_id: string;
  broker_credential_id: string | null;
  broker: string;
  managed_by: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  price_type: PriceType;
  quantity: number;
  price: string | null;
  trigger_price: string | null;
  status: OrderStatus;
  broker_order_id: string | null;
  executed_quantity: number;
  average_price: string | null;
  rejection_reason: string | null;
  basket_id: string | null;
  placed_at: string;
  executed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface PlaceOrderPayload {
  client_id: string;
  broker_credential_id?: string;
  broker: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  price_type: PriceType;
  quantity: number;
  price?: string;
  trigger_price?: string;
}

export interface OrderStats {
  total: number;
  today: number;
  executed: number;
  pending: number;
  cancelled: number;
  rejected: number;
  today_executed: number;
  today_pending: number;
}

export interface BasketItem {
  symbol: string;
  exchange: string;
  side: OrderSide;
  price_type: PriceType;
  quantity: number;
  price?: string;
}

export interface BasketPayload {
  name: string;
  description?: string;
  items: BasketItem[];
}

export interface Basket {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  status: 'DRAFT' | 'EXECUTING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
  total_orders: number;
  executed_orders: number;
  failed_orders: number;
  created_at: string;
  executed_at: string | null;
  items?: BasketItem[];
}

export const ordersService = {
  // Orders
  place: (payload: PlaceOrderPayload) =>
    orderApi.post<Order>('/orders', payload),

  list: (params?: {
    page?: number; size?: number; client_id?: string; broker?: string;
    side?: string; status?: string; symbol?: string; date_from?: string; date_to?: string;
  }) => orderApi.get<OrderListResponse>('/orders', { params }),

  get: (id: string) =>
    orderApi.get<Order>(`/orders/${id}`),

  cancel: (id: string, reason?: string) =>
    orderApi.patch<Order>(`/orders/${id}/cancel`, { reason }),

  stats: () =>
    orderApi.get<OrderStats>('/orders/stats/summary'),

  // Baskets
  createBasket: (payload: BasketPayload) =>
    orderApi.post<Basket>('/baskets', payload),

  listBaskets: () =>
    orderApi.get<Basket[]>('/baskets'),

  getBasket: (id: string) =>
    orderApi.get<Basket>(`/baskets/${id}`),

  executeBasket: (id: string, clientIds: string[], credentialIds?: string[]) =>
    orderApi.post(`/baskets/${id}/execute`, {
      client_ids: clientIds,
      broker_credential_ids: credentialIds,
    }),

  getBasketOrders: (basketId: string) =>
    orderApi.get<Order[]>(`/baskets/${basketId}/orders`),
};
