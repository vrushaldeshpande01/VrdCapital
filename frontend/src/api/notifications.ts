import { notificationApi } from './client';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface NotificationListResponse {
  items: AppNotification[];
  total: number;
  unread: number;
  page: number;
  size: number;
}

export type AlertCondition =
  | 'price_above' | 'price_below'
  | 'change_pct_up' | 'change_pct_dn'
  | 'pnl_above' | 'pnl_below';

export interface Alert {
  id: string;
  symbol: string | null;
  client_id: string | null;
  condition: string;
  threshold: number;
  label: string | null;
  status: string;
  fired_count: number;
  repeat_count: number | null;
  triggered_at: string | null;
  created_at: string;
}

export interface CreateAlertPayload {
  symbol?: string;
  client_id?: string;
  condition: AlertCondition;
  threshold: number;
  label?: string;
  repeat_count?: number | null;
}

export const notificationService = {
  listAlerts: (status?: string) =>
    notificationApi.get<Alert[]>('/alerts', { params: status ? { status } : {} }),

  createAlert: (payload: CreateAlertPayload) =>
    notificationApi.post<Alert>('/alerts', payload),

  updateAlert: (id: string, payload: Partial<{ status: string; label: string; threshold: number; repeat_count: number | null }>) =>
    notificationApi.patch<Alert>(`/alerts/${id}`, payload),

  deleteAlert: (id: string) =>
    notificationApi.delete(`/alerts/${id}`),

  evaluateAlerts: () =>
    notificationApi.post<{ evaluated: number; triggered: number }>('/alerts/evaluate'),
};

export const notificationsService = {
  list: (params?: { unread_only?: boolean; page?: number; size?: number }) =>
    notificationApi.get<NotificationListResponse>('/notifications', { params }),

  markRead: (id: string) =>
    notificationApi.patch<AppNotification>(`/notifications/${id}/read`),

  markAllRead: () =>
    notificationApi.patch('/notifications/read-all'),

  stats: () =>
    notificationApi.get<{ unread: number }>('/notifications/stats'),
};
