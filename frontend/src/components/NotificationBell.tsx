import { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconButton, Badge, Popover, Box, Typography, List, ListItem,
  ListItemText, Divider, Button, Chip, CircularProgress,
} from '@mui/material';
import { Notifications, NotificationsNone, Circle } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { notificationsService, AppNotification } from '@/api/notifications';

const TYPE_COLOR: Record<string, string> = {
  ORDER_EXECUTED: '#2e7d32',
  ORDER_FAILED: '#c62828',
  ORDER_CANCELLED: '#e65100',
  BASKET_COMPLETED: '#1565c0',
  BASKET_FAILED: '#c62828',
  KYC_UPDATED: '#6a1b9a',
  CLIENT_ADDED: '#00695c',
  SYSTEM: '#757575',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch stats (unread count) — poll every 30s
  const { data: stats } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: () => notificationsService.stats().then(r => r.data),
    refetchInterval: 30_000,
    retry: false,
  });

  // Fetch list when popover is open
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.list({ size: 20 }).then(r => r.data),
    enabled: !!anchor,
    retry: false,
  });

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notification-stats'] });
    },
  });

  const { mutate: markAll } = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notification-stats'] });
    },
  });

  // WebSocket for real-time notifications
  const connectWs = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/notifications?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          // Show toast
          enqueueSnackbar(
            <Box>
              <Typography fontWeight={700} fontSize={13}>{data.title}</Typography>
              <Typography fontSize={12}>{data.message}</Typography>
            </Box>,
            { variant: 'info', autoHideDuration: 5000 }
          );
          // Refresh stats and list
          qc.invalidateQueries({ queryKey: ['notification-stats'] });
          qc.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      // Reconnect after 5s
      setTimeout(connectWs, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };

    // Ping every 30s to keep alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 30000);

    ws.onclose = () => {
      clearInterval(pingInterval);
      setTimeout(connectWs, 5000);
    };

    wsRef.current = ws;
  }, [enqueueSnackbar, qc]);

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWs]);

  const notifications = data?.items || [];
  const unreadCount = stats?.unread ?? data?.unread ?? 0;

  return (
    <>
      <IconButton
        onClick={(e) => setAnchor(e.currentTarget)}
        size="small"
        sx={{ color: 'text.secondary' }}
      >
        <Badge badgeContent={unreadCount || null} color="error" max={99}>
          {unreadCount > 0 ? <Notifications /> : <NotificationsNone />}
        </Badge>
      </IconButton>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, borderRadius: 2, boxShadow: 4 } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography fontWeight={700}>
            Notifications {unreadCount > 0 && <Chip label={unreadCount} size="small" color="error" sx={{ ml: 0.5, height: 18, fontSize: 11 }} />}
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={() => markAll()} sx={{ fontSize: 11 }}>
              Mark all read
            </Button>
          )}
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <NotificationsNone sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary" fontSize={13}>No notifications yet</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
            {notifications.map((n: AppNotification, idx: number) => (
              <Box key={n.id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    px: 2, py: 1.5,
                    bgcolor: n.is_read ? 'transparent' : 'action.hover',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
                  <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                    <Circle sx={{ fontSize: 8, mt: 0.8, color: n.is_read ? 'transparent' : 'primary.main', flexShrink: 0 }} />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.25 }}>
                        <Typography fontSize={13} fontWeight={n.is_read ? 400 : 700} noWrap sx={{ flexGrow: 1, mr: 1 }}>
                          {n.title}
                        </Typography>
                        <Typography fontSize={11} color="text.disabled" flexShrink={0}>
                          {timeAgo(n.created_at)}
                        </Typography>
                      </Box>
                      <Typography fontSize={12} color="text.secondary" sx={{ lineHeight: 1.4 }}>
                        {n.message}
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          label={n.type.replace(/_/g, ' ')}
                          size="small"
                          sx={{ height: 16, fontSize: 10, bgcolor: TYPE_COLOR[n.type] + '20', color: TYPE_COLOR[n.type] }}
                        />
                      </Box>
                    </Box>
                  </Box>
                </ListItem>
                {idx < notifications.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
