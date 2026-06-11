import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, List, ListItem,
  ListItemIcon, ListItemText, Divider, IconButton, Button,
  Tabs, Tab, Avatar, Switch, FormControlLabel,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, Warning, Info, CheckCircle,
  NotificationsActive, Delete, DoneAll, Settings,
} from '@mui/icons-material';

const NOTIFICATIONS = [
  { id: '1', type: 'ALERT', title: 'Price Alert Triggered', body: 'BAJFINANCE crossed ₹7,000 — target price reached for client Meera Nair', time: '10 min ago', read: false, color: 'warning' },
  { id: '2', type: 'TRADE', title: 'Order Executed', body: 'BUY 50 RELIANCE @ ₹2,485.60 executed for Rajesh Kumar via Zerodha', time: '32 min ago', read: false, color: 'success' },
  { id: '3', type: 'TRADE', title: 'Order Executed', body: 'SELL 25 TCS @ ₹3,892.40 executed for Priya Sharma via Upstox', time: '1 hr ago', read: false, color: 'success' },
  { id: '4', type: 'ALERT', title: 'Margin Warning', body: 'Amit Patel\'s margin utilization exceeded 80%. Current: 84%', time: '2 hrs ago', read: true, color: 'error' },
  { id: '5', type: 'SYSTEM', title: 'Basket Order Completed', body: 'Nifty50 Rebalance basket executed successfully across 12 clients', time: '3 hrs ago', read: true, color: 'info' },
  { id: '6', type: 'REPORT', title: 'Report Ready', body: 'Portfolio Summary for June 2026 has been generated and is ready to download', time: '5 hrs ago', read: true, color: 'info' },
  { id: '7', type: 'ALERT', title: 'Portfolio Drawdown', body: 'Vikram Singh\'s portfolio is down 5.2% from peak. Consider review.', time: 'Yesterday', read: true, color: 'warning' },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  ALERT: <Warning fontSize="small" />,
  TRADE: <TrendingUp fontSize="small" />,
  SYSTEM: <Info fontSize="small" />,
  REPORT: <CheckCircle fontSize="small" />,
};

const COLOR_MAP: Record<string, 'warning' | 'success' | 'error' | 'info'> = {
  warning: 'warning', success: 'success', error: 'error', info: 'info',
};

export default function NotificationsPage() {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState(NOTIFICATIONS);
  const [showSettings, setShowSettings] = useState(false);

  const unread = items.filter(n => !n.read).length;
  const filtered = tab === 0 ? items : tab === 1 ? items.filter(n => !n.read) : items.filter(n => n.read);

  const markAllRead = () => setItems(n => n.map(x => ({ ...x, read: true })));
  const deleteItem = (id: string) => setItems(n => n.filter(x => x.id !== id));
  const markRead = (id: string) => setItems(n => n.map(x => x.id === id ? { ...x, read: true } : x));

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
          <Button size="small" startIcon={<DoneAll />} onClick={markAllRead} disabled={unread === 0} sx={{ borderRadius: 2 }}>
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
            <Tab label={`All (${items.length})`} />
            <Tab label={`Unread (${unread})`} />
            <Tab label="Read" />
          </Tabs>
        </Box>
        <List disablePadding>
          {filtered.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <NotificationsActive sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No notifications here</Typography>
            </Box>
          )}
          {filtered.map((n, i) => (
            <Box key={n.id}>
              <ListItem
                sx={{
                  px: 2.5, py: 1.5,
                  bgcolor: n.read ? 'transparent' : 'primary.50',
                  '&:hover': { bgcolor: 'action.hover' },
                  cursor: n.read ? 'default' : 'pointer',
                }}
                onClick={() => !n.read && markRead(n.id)}
                secondaryAction={
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteItem(n.id); }}>
                    <Delete fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemIcon sx={{ minWidth: 44 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: `${COLOR_MAP[n.color]}.light`, color: `${COLOR_MAP[n.color]}.dark` }}>
                    {ICON_MAP[n.type]}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={n.read ? 400 : 700} sx={{ pr: 4 }}>{n.title}</Typography>
                      {!n.read && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pr: 4 }}>{n.body}</Typography>
                      <Typography variant="caption" color="text.disabled">{n.time}</Typography>
                    </Box>
                  }
                />
              </ListItem>
              {i < filtered.length - 1 && <Divider />}
            </Box>
          ))}
        </List>
      </Card>
    </Box>
  );
}
