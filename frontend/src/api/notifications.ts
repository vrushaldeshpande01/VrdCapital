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
