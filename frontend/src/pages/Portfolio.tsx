import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, TextField,
  InputAdornment, Avatar, LinearProgress, Tabs, Tab, Skeleton,
  Table, TableBody, TableRow, TableCell, TableHead, Alert,
} from '@mui/material';
import { Search, TrendingUp, TrendingDown } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { portfolioService } from '@/api/portfolio';
import type { Holding } from '@/types';

const SECTOR_COLORS = ['#1a237e', '#00897b', '#f57c00', '#c62828', '#6a1b9a', '#37474f', '#0277bd'];

// Demo client — replace with real client selector in production
const DEMO_CLIENT = '00000000-0000-0000-0000-000000000001';

function fmt(n: number | null | undefined, prefix = '₹') {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${prefix}${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${prefix}${(n / 1e5).toFixed(2)} L`;
  return `${prefix}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`;
}

function PnLChip({ value }: { value: number | null }) {
  if (value == null) return <Typography variant="body2">—</Typography>;
  const pos = value >= 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {pos ? <TrendingUp sx={{ fontSize: 14, color: 'success.main' }} /> : <TrendingDown sx={{ fontSize: 14, color: 'error.main' }} />}
      <Typography variant="body2" fontWeight={600} color={pos ? 'success.main' : 'error.main'}>
        {fmt(value)}
      </Typography>
    </Box>
  );
}

function SummaryCard({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <Card>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {loading ? <><Skeleton /><Skeleton width="60%" /></> : (
          <>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="h6" fontWeight={700}>{value}</Typography>
            {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function PortfolioPage() {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['portfolio-summary', DEMO_CLIENT],
    queryFn: () => portfolioService.getSummary(DEMO_CLIENT),
    refetchInterval: 30_000,
  });

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery({
    queryKey: ['holdings', DEMO_CLIENT],
    queryFn: () => portfolioService.getHoldings(DEMO_CLIENT),
    refetchInterval: 30_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['portfolio-history', DEMO_CLIENT],
    queryFn: () => portfolioService.getHistory(DEMO_CLIENT, 30),
  });

  const filtered = holdings.filter(
    (h: Holding) =>
      h.symbol.toLowerCase().includes(search.toLowerCase()) ||
      (h.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (h.sector ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const chartData = history.map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    value: parseFloat(String(s.total_value)) / 1e5,
  }));

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Portfolio</Typography>
        <Typography variant="body2" color="text.secondary">
          Holdings, positions, and P&amp;L analysis
        </Typography>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Value', value: fmt(summary?.total_value), sub: `Cash: ${fmt(summary?.cash_balance)}` },
          { label: 'Invested', value: fmt(summary?.invested_value), sub: `${summary?.total_holdings ?? 0} holdings` },
          { label: 'Unrealized P&L', value: fmt(summary?.unrealized_pnl), sub: fmtPct(summary?.unrealized_pnl_pct) },
          { label: "Today's P&L", value: fmt(summary?.day_pnl), sub: fmtPct(summary?.day_return_pct) },
        ].map((c) => (
          <Grid item xs={6} md={3} key={c.label}>
            <SummaryCard {...c} loading={summaryLoading} />
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
            <Tab label="Holdings" />
            <Tab label="Sector Allocation" />
            <Tab label="Growth Chart" />
          </Tabs>
        </Box>

        <CardContent sx={{ p: 2.5 }}>
          {/* Holdings tab */}
          {tab === 0 && (
            <>
              <Box sx={{ mb: 2 }}>
                <TextField
                  placeholder="Search symbol, name, sector..."
                  size="small"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
                  sx={{ width: 300, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Box>

              {holdingsLoading ? (
                <LinearProgress />
              ) : filtered.length === 0 ? (
                <Alert severity="info">No holdings found. Add holdings to get started.</Alert>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Symbol', 'Qty', 'Avg Price', 'Current Price', 'Invested', 'Current Value', 'Unrealized P&L', 'Day P&L', 'Sector'].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.map((h: Holding) => (
                        <TableRow key={h.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.65rem', fontWeight: 700 }}>
                                {h.symbol.slice(0, 2)}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight={700}>{h.symbol}</Typography>
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120, display: 'block' }}>
                                  {h.name}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: 13 }}>{Number(h.quantity).toLocaleString('en-IN')}</TableCell>
                          <TableCell sx={{ fontSize: 13 }}>₹{Number(h.average_buy_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>
                            {h.current_price ? `₹${Number(h.current_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                          </TableCell>
                          <TableCell sx={{ fontSize: 13 }}>{fmt(h.invested_value ? Number(h.invested_value) : null)}</TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{fmt(h.current_value ? Number(h.current_value) : null)}</TableCell>
                          <TableCell>
                            <Box>
                              <PnLChip value={h.unrealized_pnl ? Number(h.unrealized_pnl) : null} />
                              {h.unrealized_pnl_pct != null && (
                                <Chip
                                  label={fmtPct(Number(h.unrealized_pnl_pct))}
                                  size="small"
                                  color={Number(h.unrealized_pnl_pct) >= 0 ? 'success' : 'error'}
                                  sx={{ height: 18, fontSize: 10, mt: 0.3 }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <PnLChip value={h.day_pnl ? Number(h.day_pnl) : null} />
                          </TableCell>
                          <TableCell>
                            {h.sector && (
                              <Chip label={h.sector} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals row */}
                  {summary && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <Box><Typography variant="caption" color="text.secondary">Total Invested</Typography><Typography fontWeight={700}>{fmt(Number(summary.invested_value))}</Typography></Box>
                      <Box><Typography variant="caption" color="text.secondary">Total Value</Typography><Typography fontWeight={700}>{fmt(Number(summary.holdings_value))}</Typography></Box>
                      <Box><Typography variant="caption" color="text.secondary">Total Unrealized P&L</Typography>
                        <Typography fontWeight={700} color={Number(summary.unrealized_pnl) >= 0 ? 'success.main' : 'error.main'}>
                          {fmt(Number(summary.unrealized_pnl))} ({fmtPct(summary.unrealized_pnl_pct ? Number(summary.unrealized_pnl_pct) : null)})
                        </Typography>
                      </Box>
                      <Box><Typography variant="caption" color="text.secondary">Today's P&L</Typography>
                        <Typography fontWeight={700} color={Number(summary.day_pnl) >= 0 ? 'success.main' : 'error.main'}>
                          {fmt(Number(summary.day_pnl))}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </>
          )}

          {/* Sector Allocation tab */}
          {tab === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={summary?.sector_allocation ?? []}
                      cx="50%" cy="50%"
                      innerRadius={70} outerRadius={110}
                      dataKey="weight_pct" nameKey="sector" paddingAngle={2}
                    >
                      {(summary?.sector_allocation ?? []).map((_, i) => (
                        <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Weight']} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </Grid>
              <Grid item xs={12} md={7}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Sector</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Weight</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Allocation</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(summary?.sector_allocation ?? []).map((s, i) => (
                      <TableRow key={s.sector} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                            {s.sector}
                          </Box>
                        </TableCell>
                        <TableCell>{fmt(s.value)}</TableCell>
                        <TableCell>{s.weight_pct.toFixed(1)}%</TableCell>
                        <TableCell sx={{ width: 120 }}>
                          <LinearProgress
                            variant="determinate"
                            value={s.weight_pct}
                            sx={{ height: 6, borderRadius: 3, bgcolor: '#eee', '& .MuiLinearProgress-bar': { bgcolor: SECTOR_COLORS[i % SECTOR_COLORS.length] } }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Grid>
            </Grid>
          )}

          {/* Growth Chart tab */}
          {tab === 2 && (
            chartData.length === 0 ? (
              <Alert severity="info">No historical snapshots yet. Create daily snapshots to see growth chart.</Alert>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1a237e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1a237e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit=" L" />
                  <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)} L`, 'Portfolio Value']} />
                  <Area type="monotone" dataKey="value" stroke="#1a237e" strokeWidth={2.5} fill="url(#portfolioGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
