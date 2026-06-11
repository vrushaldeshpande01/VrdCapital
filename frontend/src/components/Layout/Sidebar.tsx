import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Avatar, Chip, Tooltip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  AccountBalance as PortfolioIcon,
  ShoppingCart as OrdersIcon,
  BarChart as ReportsIcon,
  Notifications as NotificationsIcon,
  Security as AuditIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useAppSelector } from '@/store';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Clients', path: '/clients', icon: <PeopleIcon />, roles: ['admin', 'portfolio_manager'] },
  { label: 'Portfolio', path: '/portfolio', icon: <PortfolioIcon /> },
  { label: 'Orders', path: '/orders', icon: <OrdersIcon /> },
  { label: 'Basket Orders', path: '/basket-orders', icon: <TrendingUpIcon />, roles: ['admin', 'portfolio_manager'] },
  { label: 'Reports', path: '/reports', icon: <ReportsIcon /> },
  { label: 'Notifications', path: '/notifications', icon: <NotificationsIcon /> },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: 'User Management', path: '/users', icon: <AdminIcon />, roles: ['admin'] },
  { label: 'Audit Logs', path: '/audit-logs', icon: <AuditIcon />, roles: ['admin', 'portfolio_manager'] },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
];

const ROLE_COLORS: Record<string, 'primary' | 'secondary' | 'default'> = {
  admin: 'primary',
  portfolio_manager: 'secondary',
  client: 'default',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  portfolio_manager: 'Portfolio Manager',
  client: 'Client',
};

interface SidebarProps {
  drawerWidth: number;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ drawerWidth, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const hasAccess = (item: NavItem) => {
    if (!item.roles) return true;
    return user ? item.roles.includes(user.role) : false;
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1a237e' }}>
      {/* Logo */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 38, height: 38, borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <TrendingUpIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2, fontSize: '1rem' }}>
            VrdCapital
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem' }}>
            Portfolio Management
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* User info */}
      {user && (
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main', fontSize: '0.85rem' }}>
            {user.full_name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body2" noWrap sx={{ color: '#fff', fontWeight: 600, fontSize: '0.82rem' }}>
              {user.full_name}
            </Typography>
            <Chip
              label={ROLE_LABELS[user.role] || user.role}
              size="small"
              color={ROLE_COLORS[user.role] || 'default'}
              sx={{ height: 18, fontSize: '0.6rem', mt: 0.3 }}
            />
          </Box>
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* Main nav */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
        <List dense disablePadding>
          {NAV_ITEMS.filter(hasAccess).map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Tooltip key={item.path} title="" placement="right">
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 1, my: 0.3, borderRadius: 2, px: 1.5,
                    bgcolor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.85rem',
                      fontWeight: active ? 600 : 400,
                      color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                    }}
                  />
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1, mx: 2 }} />

        <Typography variant="caption" sx={{ px: 2.5, color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 1 }}>
          Administration
        </Typography>
        <List dense disablePadding sx={{ mt: 0.5 }}>
          {ADMIN_ITEMS.filter(hasAccess).map((item) => {
            const active = location.pathname === item.path;
            return (
              <ListItemButton
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  mx: 1, my: 0.3, borderRadius: 2, px: 1.5,
                  bgcolor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.85rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem' }}>
          VrdCapital PMS v1.0.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', border: 'none' },
        }}
      >
        {drawer}
      </Drawer>
      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: drawerWidth, boxSizing: 'border-box', border: 'none',
            boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
          },
        }}
        open
      >
        {drawer}
      </Drawer>
    </>
  );
}
