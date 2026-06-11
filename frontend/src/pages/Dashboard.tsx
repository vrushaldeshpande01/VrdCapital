import { Grid, Card, CardContent, Typography, Box, Skeleton, Chip } from '@mui/material';
import {
  TrendingUp, People, AccountBalance, ShoppingCart,
  ArrowUpward, ArrowDownward,
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '@/store';
import { clientsService } from '@/api/clients';

const PORTFOLIO_GROWTH = [
  { month: 'Jan', aum: 420, returns: 2.1 },
  { month: 'Feb', aum: 450, returns: 3.5 },
  { month: 'Mar', aum: 430, returns: -2.2 },
  { month: 'Apr', aum: 490, returns: 4.8 },
  { month: 'May', aum: 520, returns: 6.1 },
  { month: 'Jun', aum: 560, returns: 7.7 },
  { month: 'Jul', aum: 540, returns: -3.6 },
  { month: 'Aug', aum: 590, returns: 9.2 },
  { month: 'Sep', aum: 620, returns: 5.1 },
  { month: 'Oct', aum: 680, returns: 9.7 },
  { month: 'Nov', aum: 710, returns: 4.4 },
  { month: 'Dec', aum: 750, returns: 5.6 },
];

const SECTOR_DATA = [
  { name: 'Technology', value: 28 },
  { name: 'Finance', value: 22 },
  { name: 'Healthcare', value: 18 },
  { name: 'Energy', value: 12 },
  { name: 'FMCG', value: 10 },
  { name: 'Others', value: 10 },
];

const SECTOR_COLORS = ['#1a237e', '#00897b', '#f57c00', '#c62828', '#6a1b9a', '#37474f'];

const RECENT_ORDERS = [
  { id: 1, client: 'Rajesh Kumar', symbol: 'RELIANCE', type: 'BUY', qty: 50, price: 2485.60, status: 'EXECUTED', time: '10:32 AM' },
  { id: 2, client: 'Priya Sharma', symbol: 'TCS', type: 'SELL', qty: 25, price: 3892.40, status: 'EXECUTED', time: '11:05 AM' },
  { id: 3, client: 'Amit Patel', symbol: 'HDFC', type: 'BUY', qty: 30, price: 1672.80, status: 'PENDING', time: '11:48 AM' },
  { id: 4, client: 'Sneha Joshi', symbol: 'INFOSYS', type: 'BUY', qty: 100, price: 1458.20, status: 'EXECUTED', time: '12:15 PM' },
  { id: 5, client: 'Vikram Singh', symbol: 'WIPRO', type: 'SELL', qty: 75, price: 485.60, status: 'CANCELLED', time: '02:22 PM' },
];

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

function StatCard({ title, value, change, positive, icon, color, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        {loading ? (
          <>
            <Skeleton width={120} />
            <Skeleton width={80} height={40} />
            <Skeleton width={100} />
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {title}
              </Typography>
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ color }}>{icon}</Box>
              </Box>
            </Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              {value}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {positive ? (
                <ArrowUpward sx={{ fontSize: 14, color: 'success.main' }} />
              ) : (
                <ArrowDownward sx={{ fontSize: 14, color: 'error.main' }} />
              )}
              <Typography variant="caption" color={positive ? 'success.main' : 'error.main'} fontWeight={600}>
                {change}
              </Typography>
              <Typography variant="caption" color="text.secondary">vs last month</Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['client-stats'],
    queryFn: clientsService.getStats,
  });

  const statusColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    EXECUTED: 'success',
    PENDING: 'warning',
    CANCELLED: 'error',
  };

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome back, {user?.full_name}. Here's your portfolio overview.
        </Typography>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total AUM"
            value="₹75.2 Cr"
            change="+12.4%"
            positive
            icon={<AccountBalance fontSize="small" />}
            color="#1a237e"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Active Clients"
            value={stats ? String(stats.active_clients) : '—'}
            change="+5"
            positive
            icon={<People fontSize="small" />}
            color="#00897b"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Today's P&L"
            value="₹18.4 L"
            change="+2.36%"
            positive
            icon={<TrendingUp fontSize="small" />}
            color="#2e7d32"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Open Orders"
            value="12"
            change="-3"
            positive={false}
            icon={<ShoppingCart fontSize="small" />}
            color="#e65100"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Charts row */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* AUM Growth */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                AUM Growth (₹ Crore)
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={PORTFOLIO_GROWTH}>
                  <defs>
                    <linearGradient id="aumGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a237e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1a237e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`₹${v} Cr`, 'AUM']} />
                  <Area
                    type="monotone"
                    dataKey="aum"
                    stroke="#1a237e"
                    strokeWidth={2.5}
                    fill="url(#aumGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Sector Allocation */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Sector Allocation
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={SECTOR_DATA}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {SECTOR_DATA.map((_, i) => (
                      <Cell key={i} fill={SECTOR_COLORS[i]} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>}
                  />
                  <Tooltip formatter={(v) => [`${v}%`, 'Allocation']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Orders */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Recent Orders
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Client', 'Symbol', 'Type', 'Qty', 'Price', 'Status', 'Time'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#666', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT_ORDERS.map((order) => (
                  <tr key={order.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{order.client}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{order.symbol}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Chip
                        label={order.type}
                        size="small"
                        color={order.type === 'BUY' ? 'success' : 'error'}
                        sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{order.qty}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>₹{order.price.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Chip
                        label={order.status}
                        size="small"
                        color={statusColor[order.status] || 'default'}
                        variant="outlined"
                        sx={{ height: 20, fontSize: 11 }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>{order.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
