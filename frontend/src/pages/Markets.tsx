import { useState, useMemo } from 'react';
import {
  Box, Typography, Card, TextField, InputAdornment, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Chip, CircularProgress, IconButton, Tooltip,
  Alert,
} from '@mui/material';
import {
  Search, TrendingUp, TrendingDown, Refresh, ShowChart,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { brokerApi } from '@/api/client';
import { useAppDispatch } from '@/store';
import { openOrderModal } from '@/store/tradingSlice';

interface StockRow {
  symbol: string;
  name: string;
  sector: string;
  ltp: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  week52_high: number | null;
  week52_low: number | null;
  week52_change_pct: number | null;
}

type SortKey = keyof StockRow;
type SortDir = 'asc' | 'desc';

const fmt = (n: number | null, digits = 2) =>
  n == null ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });

const fmtCap = (n: number | null) => {
  if (n == null) return '—';
  if (n >= 1e12) return `₹${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `₹${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e7)  return `₹${(n / 1e7).toFixed(2)}Cr`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const fmtVol = (n: number | null) => {
  if (n == null) return '—';
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  return n.toLocaleString('en-IN');
};

const ChangeCell = ({ val }: { val: number | null }) => {
  if (val == null) return <TableCell align="right">—</TableCell>;
  const up = val >= 0;
  return (
    <TableCell align="right" sx={{ color: up ? 'success.main' : 'error.main', fontWeight: 600 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4 }}>
        {up ? <TrendingUp sx={{ fontSize: 14 }} /> : <TrendingDown sx={{ fontSize: 14 }} />}
        {up ? '+' : ''}{fmt(val)}%
      </Box>
    </TableCell>
  );
};

const SECTOR_COLORS: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  Finance: 'primary', Technology: 'info', Energy: 'warning', Healthcare: 'success',
  Auto: 'default', FMCG: 'success', Metals: 'error', Telecom: 'primary',
};

export default function MarketsPage() {
  const dispatch = useAppDispatch();
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('market_cap');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: sectorsData } = useQuery({
    queryKey: ['market-sectors'],
    queryFn: () => brokerApi.get<{ sectors: string[] }>('/market/sectors').then(r => r.data),
    staleTime: Infinity,
  });

  const { data, isFetching, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['market-screener', sector],
    queryFn: () =>
      brokerApi.get<{ stocks: StockRow[]; delayed_by: string }>('/market/screener', {
        params: sector ? { sector } : {},
      }).then(r => r.data),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const rows = useMemo(() => {
    let list = data?.stocks ?? [];
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter(r => r.symbol.includes(q) || r.name.toUpperCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
      const bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [data, search, sortKey, sortDir]);

  const SortCell = ({ label, field }: { label: string; field: SortKey }) => (
    <TableCell align={field === 'symbol' || field === 'name' || field === 'sector' ? 'left' : 'right'} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
      <TableSortLabel
        active={sortKey === field}
        direction={sortKey === field ? sortDir : 'desc'}
        onClick={() => handleSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN') : null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Indian Markets</Typography>
          <Typography variant="body2" color="text.secondary">
            Nifty 50 stocks · NSE/BSE · Real-time via Alpha Vantage
            {updatedAt && ` · Updated ${updatedAt}`}
          </Typography>
        </Box>
        <Tooltip title="Refresh prices">
          <IconButton onClick={() => refetch()} disabled={isFetching} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            {isFetching ? <CircularProgress size={18} /> : <Refresh fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load market data. Please try refreshing.
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search symbol or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 260 }}
        />
        <TextField
          select
          size="small"
          label="Sector"
          value={sector}
          onChange={e => setSector(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All Sectors</MenuItem>
          {(sectorsData?.sectors ?? []).map(s => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {isFetching ? 'Loading…' : `${rows.length} stocks`}
        </Typography>
      </Box>

      {/* Table */}
      <Card sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#f8f9fa', borderBottom: '2px solid', borderColor: 'divider' } }}>
                <SortCell label="Symbol"       field="symbol" />
                <SortCell label="Name"         field="name" />
                <SortCell label="Sector"       field="sector" />
                <SortCell label="Price (₹)"    field="ltp" />
                <SortCell label="Change"       field="change" />
                <SortCell label="Change %"     field="change_pct" />
                <SortCell label="Avg Vol (3M)" field="volume" />
                <SortCell label="Market Cap"   field="market_cap" />
                <SortCell label="P/E (TTM)"    field="pe_ratio" />
                <SortCell label="52W High"     field="week52_high" />
                <SortCell label="52W Low"      field="week52_low" />
                <SortCell label="52W Chg %"    field="week52_change_pct" />
                <TableCell align="center" sx={{ fontWeight: 700 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isFetching && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Fetching live prices from Alpha Vantage…
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : rows.map((row) => {
                const up = (row.change_pct ?? 0) >= 0;
                return (
                  <TableRow
                    key={row.symbol}
                    hover
                    sx={{ '&:last-child td': { border: 0 } }}
                  >
                    <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {row.symbol}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 180 }}>
                      <Typography variant="body2" noWrap>{row.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.sector}
                        size="small"
                        color={SECTOR_COLORS[row.sector] ?? 'default'}
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {row.ltp != null ? `₹${fmt(row.ltp)}` : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: up ? 'success.main' : 'error.main', fontWeight: 600 }}>
                      {row.change != null ? `${row.change >= 0 ? '+' : ''}₹${fmt(row.change)}` : '—'}
                    </TableCell>
                    <ChangeCell val={row.change_pct} />
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>{fmtVol(row.volume)}</TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>{fmtCap(row.market_cap)}</TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {row.pe_ratio != null ? row.pe_ratio.toFixed(1) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {row.week52_high != null ? `₹${fmt(row.week52_high)}` : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {row.week52_low != null ? `₹${fmt(row.week52_low)}` : '—'}
                    </TableCell>
                    <ChangeCell val={row.week52_change_pct} />
                    <TableCell align="center">
                      <Tooltip title="Place order">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => dispatch(openOrderModal({
                            instrument: {
                              id: row.symbol,
                              symbol: row.symbol,
                              name: row.name,
                              exchange: 'NSE',
                              instrument_type: 'EQUITY',
                              lot_size: 1,
                              tick_size: '0.05',
                              ltp: String(row.ltp ?? 0),
                            },
                            side: 'BUY',
                          }))}
                        >
                          <ShowChart fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
