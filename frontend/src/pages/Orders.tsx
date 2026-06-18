import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, TextField,
  InputAdornment, Grid, MenuItem, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import { Search, Cancel, Refresh, CallMade, OpenInNew } from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { ordersService, PlaceOrderPayload, Order, OrderSide, PriceType } from '@/api/orders';
import { clientsService } from '@/api/clients';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  EXECUTED: 'success', PENDING: 'warning', OPEN: 'info',
  SUBMITTED: 'info', PARTIALLY_EXECUTED: 'warning',
  CANCELLED: 'error', REJECTED: 'error', FAILED: 'error',
};

const today = new Date().toISOString().slice(0, 10);

const columns = (
  onCancel: (id: string) => void,
  onExit: (order: Order) => void,
  clientMap: Record<string, string>,
): GridColDef<Order>[] => [
  {
    field: 'client_id', headerName: 'Client', width: 130, headerAlign: 'center',
    renderCell: ({ value }) => (
      <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <Typography fontSize={12} noWrap>{clientMap[value] || '—'}</Typography>
      </Box>
    ),
  },
  {
    field: 'symbol', headerName: 'Symbol', width: 100, headerAlign: 'center',
    renderCell: ({ value }) => (
      <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <Typography fontWeight={700} fontSize={13}>{value}</Typography>
      </Box>
    ),
  },
  { field: 'exchange', headerName: 'Exch', width: 60, align: 'center', headerAlign: 'center' },
  {
    field: 'side', headerName: 'Side', width: 70, headerAlign: 'center',
    renderCell: ({ value }) => (
      <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <Chip label={value} size="small" color={value === 'BUY' ? 'success' : 'error'} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
      </Box>
    ),
  },
  { field: 'price_type', headerName: 'Type', width: 80, align: 'center', headerAlign: 'center' },
  { field: 'quantity', headerName: 'Qty', width: 65, type: 'number', align: 'center', headerAlign: 'center' },
  {
    field: 'price', headerName: 'Price', width: 110, align: 'center', headerAlign: 'center',
    renderCell: ({ row }) => row.average_price
      ? `₹${Number(row.average_price).toLocaleString('en-IN')}`
      : row.price ? `₹${Number(row.price).toLocaleString('en-IN')}` : 'MARKET',
  },
  { field: 'broker', headerName: 'Broker', width: 85, align: 'center', headerAlign: 'center' },
  {
    field: 'status', headerName: 'Status', width: 130, headerAlign: 'center',
    renderCell: ({ value }) => (
      <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <Chip label={value} size="small" color={STATUS_COLOR[value] || 'default'} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
      </Box>
    ),
  },
  {
    field: 'placed_at', headerName: 'Time', width: 145, align: 'center', headerAlign: 'center',
    renderCell: ({ value }) => <Typography fontSize={12} color="text.secondary">{new Date(value).toLocaleString('en-IN')}</Typography>,
  },
  {
    field: 'actions', headerName: 'Action', width: 80, sortable: false, headerAlign: 'center',
    renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', gap: 0.5 }}>
        {['PENDING', 'OPEN', 'SUBMITTED'].includes(row.status) && (
          <Tooltip title="Cancel Order">
            <IconButton size="small" color="error" onClick={() => onCancel(row.id)}>
              <Cancel fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {row.status === 'EXECUTED' && row.side === 'BUY' && (
          <Tooltip title="Exit / Sell">
            <IconButton size="small" color="warning" onClick={() => onExit(row)}>
              <CallMade fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    ),
  },
];

export default function OrdersPage() {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [sideFilter, setSideFilter] = useState('all');
  const [brokerFilter, setBrokerFilter] = useState('all');
  const [exitOrder, setExitOrder] = useState<Order | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const statusParam = tab === 2 ? 'PENDING,OPEN,SUBMITTED' : undefined;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', page, tab, sideFilter, brokerFilter],
    queryFn: () => ordersService.list({
      page: page + 1, size: 50,
      side: sideFilter !== 'all' ? sideFilter : undefined,
      broker: brokerFilter !== 'all' ? brokerFilter : undefined,
      status: statusParam,
      date_from: tab === 1 ? `${today}T00:00:00` : undefined,
    }).then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['order-stats'],
    queryFn: () => ordersService.stats().then(r => r.data),
    refetchInterval: 30_000,
  });

  const { mutate: cancelOrder } = useMutation({
    mutationFn: (id: string) => ordersService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order-stats'] });
      enqueueSnackbar('Order cancelled', { variant: 'success' });
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || 'Failed to cancel order', { variant: 'error' }),
  });

  const { data: clientList } = useQuery({
    queryKey: ['clients', 1, ''],
    queryFn: () => clientsService.list({ page: 1, size: 200 }),
  });
  const clientMap: Record<string, string> = Object.fromEntries(
    (clientList?.items || []).map(c => [c.id, c.full_name])
  );

  const orders = (data?.items || []).filter(o =>
    !search || o.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = [
    { label: 'Total Orders', value: stats?.total ?? '—', color: '#1a237e' },
    { label: 'Executed', value: stats?.executed ?? '—', color: '#2e7d32' },
    { label: 'Pending / Open', value: stats?.pending ?? '—', color: '#e65100' },
    { label: 'Cancelled', value: stats?.cancelled ?? '—', color: '#c62828' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Order Management</Typography>
          <Typography variant="body2" color="text.secondary">Monitor all orders across clients and brokers</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()}><Refresh /></IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<OpenInNew />} onClick={() => navigate('/trading')} sx={{ borderRadius: 2 }}>
            Trading Terminal
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="h4" fontWeight={700} sx={{ color: s.color }}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); }} sx={{ px: 2 }}>
            <Tab label="All Orders" />
            <Tab label={`Today (${stats?.today ?? 0})`} />
            <Tab label={`Pending (${stats?.pending ?? 0})`} />
          </Tabs>
        </Box>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search symbol..."
              size="small" value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField select size="small" value={sideFilter} onChange={(e) => setSideFilter(e.target.value)}
              sx={{ width: 120, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <MenuItem value="all">All Sides</MenuItem>
              <MenuItem value="BUY">BUY</MenuItem>
              <MenuItem value="SELL">SELL</MenuItem>
            </TextField>
            <TextField select size="small" value={brokerFilter} onChange={(e) => setBrokerFilter(e.target.value)}
              sx={{ width: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <MenuItem value="all">All Brokers</MenuItem>
              <MenuItem value="zerodha">Zerodha</MenuItem>
              <MenuItem value="upstox">Upstox</MenuItem>
              <MenuItem value="angelone">AngelOne</MenuItem>
            </TextField>
          </Box>

          {orders.length === 0 && !isLoading && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No orders yet. Click <strong>Place Order</strong> to place your first order.
            </Alert>
          )}

          <DataGrid
            rows={orders}
            columns={columns((id) => setCancelOrderId(id), (order) => setExitOrder(order), clientMap)}
            loading={isLoading}
            rowCount={data?.total || 0}
            paginationMode="server"
            paginationModel={{ page, pageSize: 50 }}
            onPaginationModelChange={({ page: p }) => setPage(p)}
            pageSizeOptions={[50]}
            autoHeight
            disableRowSelectionOnClick
            sx={{ border: 'none', '& .MuiDataGrid-cell': { borderBottom: '1px solid #f5f5f5' }, '& .MuiDataGrid-columnHeaders': { bgcolor: '#fafafa' } }}
          />
        </CardContent>
      </Card>

      {exitOrder && (
        <ExitOrderDialog
          order={exitOrder}
          onClose={() => setExitOrder(null)}
        />
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelOrderId} onClose={() => setCancelOrderId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Cancel Order?</DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            This will send a cancel request to the broker. This action cannot be undone for orders already sent to the exchange.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setCancelOrderId(null)} sx={{ borderRadius: 2 }}>
            Go Back
          </Button>
          <Button
            variant="contained"
            color="error"
            sx={{ borderRadius: 2 }}
            onClick={() => {
              if (cancelOrderId) {
                cancelOrder(cancelOrderId);
                setCancelOrderId(null);
              }
            }}
          >
            Yes, Cancel Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ExitOrderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [qty, setQty] = useState(String(order.quantity));

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const payload: PlaceOrderPayload = {
        client_id: order.client_id,
        broker: order.broker,
        symbol: order.symbol,
        exchange: order.exchange,
        side: 'SELL' as OrderSide,
        price_type: 'MARKET' as PriceType,
        quantity: Number(qty),
      };
      return ordersService.place(payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order-stats'] });
      enqueueSnackbar(`Exit order placed — ${res.data.status}`, { variant: 'success' });
      onClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || 'Failed to place exit order', { variant: 'error' }),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <form onSubmit={(e) => { e.preventDefault(); mutate(); }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Exit Position — {order.symbol}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Places a <strong>MARKET SELL</strong> order for {order.symbol} on {order.broker}.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" type="number" label="Sell Quantity"
                value={qty} onChange={(e) => setQty(e.target.value)}
                inputProps={{ min: 1, max: order.quantity }}
                helperText={`Max: ${order.quantity} (original buy qty)`}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button type="submit" variant="contained" color="error" disabled={isPending} sx={{ borderRadius: 2, px: 3 }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Sell / Exit'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
