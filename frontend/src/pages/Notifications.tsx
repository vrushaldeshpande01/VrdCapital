import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, List, ListItem,
  ListItemIcon, ListItemText, Divider, IconButton, Button,
  Tabs, Tab, Avatar, Switch, FormControlLabel, CircularProgress,
  Alert,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, Warning, Info, CheckCircle,
  NotificationsActive, Delete, DoneAll, Settings,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService, AppNotification } from '@/api/notifications';

const ICON_MAP: Record<string, React.ReactNode> = {
  ALERT:          <Warning fontSize="small" />,
  ORDER_EXECUTED: <TrendingUp fontSize="small" />,
  ORDER_FAILED:   <TrendingDown fontSize="small" />,
  SYSTEM:         <Info fontSize="small" />,
  REPORT:         <CheckCircle fontSize="small" />,
};

const COLOR_MAP: Record<string, 'warning' | 'success' | 'error' | 'info'> = {
  ALERT:          'warning',
  ORDER_EXECUTED: 'success',
  ORDER_FAILED:   'error',
  SYSTEM:         'info',
  REPORT:         'info',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} day${Math.floor(h / 24) > 1 ? 's' : ''} ago`;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [tab, setTab]           = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const unreadOnly = tab === 1;

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', tab],
    queryFn: () => notificationsService.list({ unread_only: unreadOnly, page: 1, size: 50 }).then(r => r.data),
    refetchInterval: 30_000,
  });

  const items: AppNotification[] = data?.items ?? [];
  const unread = data?.unread ?? 0;

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const { mutate: markAll } = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const filtered = tab === 2 ? items.filter(n => n.is_read) : items;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" fontWeight={700}>Notifications</Typography>
            {unread > 0 && <Chip label={unread} size="small" color="error" sx={{ height: 20, fontSize: 11 }} />}
          </Box>
          <Typography variant="body2" color="text.secondary">Alerts, trade updates, and system messages</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<DoneAll />} onClick={() => markAll()} disabled={unread === 0} sx={{ borderRadius: 2 }}>
            Mark all read
          </Button>
          <IconButton size="small" onClick={() => setShowSettings(!showSettings)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Settings fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {showSettings && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Notification Preferences</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1 }}>
              {[
                { label: 'Trade Executions', defaultOn: true },
                { label: 'Price Alerts', defaultOn: true },
                { label: 'Margin Warnings', defaultOn: true },
                { label: 'Portfolio Alerts', defaultOn: true },
                { label: 'Report Ready', defaultOn: false },
                { label: 'System Updates', defaultOn: false },
              ].map(p => (
                <FormControlLabel
                  key={p.label}
                  control={<Switch defaultChecked={p.defaultOn} size="small" />}
                  label={<Typography variant="body2">{p.label}</Typography>}
                  sx={{ m: 0 }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
            <Tab label={`All (${data?.total ?? 0})`} />
            <Tab label={`Unread (${unread})`} />
            <Tab label="Read" />
          </Tabs>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsActive sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No notifications yet.</Typography>
            <Typography variant="caption" color="text.disabled">
              Notifications appear here when orders execute or alerts trigger.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filtered.map((n, i) => {
              const color = COLOR_MAP[n.type] ?? 'info';
              return (
                <Box key={n.id}>
                  <ListItem
                    sx={{
                      px: 2.5, py: 1.5,
                      bgcolor: n.is_read ? 'transparent' : 'primary.50',
                      '&:hover': { bgcolor: 'action.hover' },
                      cursor: n.is_read ? 'default' : 'pointer',
                    }}
                    onClick={() => !n.is_read && markRead(n.id)}
                  >
                    <ListItemIcon sx={{ minWidth: 44 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: `${color}.light`, color: `${color}.dark` }}>
                        {ICON_MAP[n.type] ?? <Info fontSize="small" />}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={n.is_read ? 400 : 700}>{n.title}</Typography>
                          {!n.is_read && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{n.message}</Typography>
                          <Typography variant="caption" color="text.disabled">{timeAgo(n.created_at)}</Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {i < filtered.length - 1 && <Divider />}
                </Box>
              );
            })}
          </List>
        )}
      </Card>
    </Box>
  );
}
