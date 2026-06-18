import { Routes, Route, Navigate } from 'react-router-dom';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import { fetchCurrentUser } from '@/store/authSlice';
import Layout from '@/components/Layout/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/Dashboard';
import ClientsPage from '@/pages/Clients';
import PortfolioPage from '@/pages/Portfolio';
import ClientDetailPage from '@/pages/ClientDetail';
import UsersPage from '@/pages/Users';
import AuditLogsPage from '@/pages/AuditLogs';
import SettingsPage from '@/pages/Settings';
import OrdersPage from '@/pages/Orders';
import ReportsPage from '@/pages/Reports';
import NotificationsPage from '@/pages/Notifications';
import ObservabilityPage from '@/pages/Observability';
import TradingPage from '@/pages/Trading';
import AlertsPage from '@/pages/Alerts';
import MarketsPage from '@/pages/Markets';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1a237e',
      light: '#534bae',
      dark: '#000051',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#00897b',
      light: '#4ebaaa',
      dark: '#005b4f',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    success: { main: '#2e7d32' },
    error: { main: '#c62828' },
    warning: { main: '#e65100' },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 700,
            backgroundColor: '#f5f5f5',
          },
        },
      },
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function AppBootstrap() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCurrentUser());
    }
  }, [isAuthenticated, dispatch]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBootstrap />
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route
          path="/"
          element={<ProtectedRoute><Layout /></ProtectedRoute>}
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="clients" element={<ErrorBoundary><ClientsPage /></ErrorBoundary>} />
          <Route path="clients/:id" element={<ErrorBoundary><ClientDetailPage /></ErrorBoundary>} />
          <Route path="portfolio" element={<ErrorBoundary><PortfolioPage /></ErrorBoundary>} />
          <Route path="users" element={<ErrorBoundary><UsersPage /></ErrorBoundary>} />
          <Route path="audit-logs" element={<ErrorBoundary><AuditLogsPage /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
          <Route path="orders" element={<ErrorBoundary><OrdersPage /></ErrorBoundary>} />
          <Route path="basket-orders" element={<Navigate to="/trading" replace />} />
          <Route path="reports" element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
          <Route path="notifications" element={<ErrorBoundary><NotificationsPage /></ErrorBoundary>} />
          <Route path="observability" element={<ErrorBoundary><ObservabilityPage /></ErrorBoundary>} />
          <Route path="trading" element={<ErrorBoundary><TradingPage /></ErrorBoundary>} />
          <Route path="alerts" element={<ErrorBoundary><AlertsPage /></ErrorBoundary>} />
          <Route path="markets" element={<ErrorBoundary><MarketsPage /></ErrorBoundary>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
