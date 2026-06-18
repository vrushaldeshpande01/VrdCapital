import { Grid, Card, CardContent, Typography, Box, Skeleton, Chip } from '@mui/material';
import {
  TrendingUp, TrendingDown, People, AccountBalance, ShoppingCart,
  ArrowUpward, ArrowDownward,
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '@/store';
import { clientsService } from '@/api/clients';
import { portfolioService } from '@/api/portfolio';
import { ordersService } from '@/api/orders';
import type { Client } from '@/types';

const SECTOR_COLORS = ['#1a237e', '#00897b', '#f57c00', '#c62828', '#6a1b9a', '#37474f', '#0277bd'];

function fmt(n: number | string | null | undefined, prefix = '₹') {
  if (n == null) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  const abs = Math.abs(num);
  if (abs >= 1e7) return `${prefix}${(num / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${prefix}${(num / 1e5).toFixed(2)} L`;
  return `${prefix}${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | string | null | undefined) {
  if (n == null) return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
}

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  positive: boolean | null;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

function StatCard({ title, value, change, positive, icon, color, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        {loading ? (
          <><Skeleton width={120} /><Skeleton width={80} height={40} /><Skeleton width={100} /></>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>{title}</Typography>
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ color }}>{icon}</Box>
              </Box>
            </Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>{value}</Typography>
            {positive !== null && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {positive
                  ? <ArrowUpward sx={{ fontSize: 14, color: 'success.main' }} />
                  : <ArrowDownward sx={{ fontSize: 14, color: 'error.main' }} />}
                <Typography variant="caption" color={positive ? 'success.main' : 'error.main'} fontWeight={600}>
                  {change}
                </Typography>
                <Typography variant="caption" color="text.secondary">today</Typography>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user);

  const { data: clientStats, isLoading: clientsLoading } = useQuery({
    queryKey: ['client-stats'],
    queryFn: clientsService.getStats,
    retry: 1,
  });

  const { data: aum, isLoading: aumLoading } = useQuery({
    queryKey: ['aum'],
    queryFn: portfolioService.getAUM,
    retry: 1,
    refetchInterval: 60_000,
  });

  const { data: clientList } = useQuery({
    queryKey: ['clients-dashboard'],
    queryFn: () => clientsService.list({ page: 1, size: 100 }),
    retry: 1,
  });
  const firstClientId = clientList?.items?.[0]?.id;
  const clientNameMap = Object.fromEntries(
    (clientList?.items ?? []).map((c: Client) => [c.id, c.full_name])
  );

  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: () => ordersService.list({ page: 1, size: 5 }).then(r => r.data.items),
    retry: 1,
    refetchInterval: 30_000,
  });

  const { data: history } = useQuery({
    queryKey: ['portfolio-history', firstClientId],
    queryFn: () => portfolioService.getHistory(firstClientId!, 12),
    enabled: !!firstClientId,
    retry: 1,
  });

  const { data: summary } = useQuery({
    queryKey: ['portfolio-summary', firstClientId],
    queryFn: () => portfolioService.getSummary(firstClientId!),
    enabled: !!firstClientId,
    retry: 1,
  });

  const chartData = (history ?? []).map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    value: parseFloat(String(s.total_value)) / 1e5,
    pnl: s.day_pnl ?? 0,
  }));

  const sectorData = summary?.sector_allocation ?? [];

  const dayPnl = aum?.total_day_pnl ?? null;
  const dayPct = aum?.day_return_pct ?? null;
  const dayPositive = dayPnl !== null ? dayPnl >= 0 : null;

  const statusColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    EXECUTED: 'success', PENDING: 'warning', CANCELLED: 'error',
  };

  const isLoading = clientsLoading || aumLoading;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Welcome back, {user?.full_name}. Here's your live portfolio overview.
        </Typography>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Total AUM"
            value={aum ? fmt(aum.total_aum) : '—'}
            change={fmtPct(aum?.day_return_pct ?? null)}
            positive={dayPositive}
            icon={<AccountBalance fontSize="small" />}
            color="#1a237e"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Active Clients"
            value={clientStats ? String(clientStats.active_clients) : '—'}
            change={`${clientStats?.total_clients ?? 0} total`}
            positive={null}
            icon={<People fontSize="small" />}
            color="#00897b"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Today's P&L"
            value={aum ? fmt(aum.total_day_pnl) : '—'}
            change={fmtPct(aum?.day_return_pct ?? null)}
            positive={dayPositive}
            icon={dayPositive ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
            color={dayPositive ? '#2e7d32' : '#c62828'}
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            title="Unrealized P&L"
            value={aum ? fmt(aum.total_unrealized_pnl) : '—'}
            change={fmt(aum?.total_invested ?? null)}
            positive={(aum?.total_unrealized_pnl ?? 0) >= 0}
            icon={<ShoppingCart fontSize="small" />}
            color="#e65100"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Secondary stats */}
      {aum && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Holdings Value', value: fmt(aum.total_holdings_value) },
            { label: 'Total Cash', value: fmt(aum.total_cash) },
            { label: 'Total Invested', value: fmt(aum.total_invested) },
            { label: 'Total Holdings', value: String(summary?.total_holdings ?? '—') },
          ].map((item) => (
            <Grid item xs={6} md={3} key={item.label}>
              <Card sx={{ bgcolor: '#fafafa' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h6" fontWeight={700}>{item.value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Charts */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Portfolio Growth (₹ Lakh)</Typography>
              {chartData.length === 0 ? (
                <Box sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No portfolio snapshots yet.</Typography>
                </Box>
              ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a237e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1a237e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`₹${Number(v).toFixed(2)} L`, 'Value']} />
                  <Area type="monotone" dataKey="value" stroke="#1a237e" strokeWidth={2.5} fill="url(#grad)" />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Sector Allocation</Typography>
              {sectorData.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                  <Typography color="text.secondary" variant="body2">No data yet</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={sectorData} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                      dataKey="weight_pct" nameKey="sector" paddingAngle={2}>
                      {sectorData.map((_, i) => (
                        <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={8}
                      formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                    <Tooltip formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'Weight']} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Holdings */}
      {summary && summary.top_holdings.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Top Holdings</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Symbol', 'Sector', 'Current Value', 'Unrealized P&L', 'Return', 'Weight'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#666', borderBottom: '1px solid #eee' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.top_holdings.map((h) => (
                    <tr key={h.symbol} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13 }}>{h.symbol}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#666' }}>{h.sector ?? '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{fmt(h.current_value)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: h.unrealized_pnl >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                        {fmt(h.unrealized_pnl)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Chip
                          label={fmtPct(h.unrealized_pnl_pct)}
                          size="small"
                          color={h.unrealized_pnl_pct >= 0 ? 'success' : 'error'}
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#666' }}>{Number(h.weight_pct).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Recent Orders</Typography>
          {ordersLoading ? (
            <Box sx={{ py: 2 }}><Skeleton /><Skeleton /><Skeleton /></Box>
          ) : !recentOrders || recentOrders.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No orders placed yet.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Client', 'Symbol', 'Type', 'Qty', 'Price', 'Status', 'Time'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#666', borderBottom: '1px solid #eee' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const price = order.average_price ?? order.price;
                    const time = new Date(order.placed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>
                          {clientNameMap[order.client_id] ?? order.client_id.slice(0, 8) + '…'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{order.symbol}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <Chip label={order.side} size="small" color={order.side === 'BUY' ? 'success' : 'error'}
                            sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>{order.quantity}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>
                          {price ? `₹${Number(price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <Chip label={order.status} size="small" color={statusColor[order.status] || 'default'}
                            variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>{time}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
