import { useState } from 'react';
import {
  Box, Tabs, Tab, Chip, IconButton, Tooltip, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, CircularProgress,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { tradingService, TradingOrder } from '@/api/trading';
import { useAppDispatch } from '@/store';
import { openOrderModal } from '@/store/tradingSlice';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  PENDING: 'info', SUBMITTED: 'info', OPEN: 'warning',
  EXECUTED: 'success', PARTIALLY_EXECUTED: 'warning',
  CANCELLED: 'default', REJECTED: 'error', FAILED: 'error',
};

const TAB_STATUSES: Record<number, string | undefined> = {
  0: 'PENDING,SUBMITTED,OPEN',
  1: 'EXECUTED,PARTIALLY_EXECUTED',
  2: 'CANCELLED',
  3: 'REJECTED,FAILED',
};

function ModifyDialog({ order, onClose }: { order: TradingOrder; onClose: () => void }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [qty, setQty] = useState(String(order.quantity));
  const [price, setPrice] = useState(order.price ?? '');

  const { mutate, isPending } = useMutation({
    mutationFn: () => tradingService.modifyOrder(order.id, {
      quantity: Number(qty),
      price: price || undefined,
    }).then((r) => r.data),
    onSuccess: () => {
      enqueueSnackbar('Order modified', { variant: 'success' });
      qc.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (err: any) => enqueueSnackbar(err?.response?.data?.detail ?? 'Modify failed', { variant: 'error' }),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Modify Order — {order.symbol}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField label="Quantity" size="small" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        {order.price_type !== 'MARKET' && (
          <TextField label="Price (₹)" size="small" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => mutate()} disabled={isPending}>
          {isPending ? <CircularProgress size={16} /> : 'Modify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface Props {
  clientId?: string;
}

export default function OrderBook({ clientId }: Props) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState(0);
  const [modifyOrder, setModifyOrder] = useState<TradingOrder | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', clientId, tab],
    queryFn: () => tradingService.listOrders({
      client_id: clientId,
      status: TAB_STATUSES[tab],
      size: 100,
    }).then((r) => r.data.items),
    refetchInterval: 5000,
  });

  const { mutate: cancel } = useMutation({
    mutationFn: (id: string) => tradingService.cancelOrder(id).then((r) => r.data),
    onSuccess: () => { enqueueSnackbar('Order cancelled', { variant: 'info' }); qc.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (err: any) => enqueueSnackbar(err?.response?.data?.detail ?? 'Cancel failed', { variant: 'error' }),
  });

  const { mutate: forceExec } = useMutation({
    mutationFn: (id: string) => tradingService.forceExecute(id).then((r) => r.data),
    onSuccess: () => { enqueueSnackbar('Order executed', { variant: 'success' }); qc.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (err: any) => enqueueSnackbar(err?.response?.data?.detail ?? 'Execute failed', { variant: 'error' }),
  });

  const orders = data ?? [];
  const isOpen = (o: TradingOrder) => ['PENDING', 'SUBMITTED', 'OPEN'].includes(o.status);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36 }}>
          <Tab label="Open" sx={{ minHeight: 36, py: 0 }} />
          <Tab label="Executed" sx={{ minHeight: 36, py: 0 }} />
          <Tab label="Cancelled" sx={{ minHeight: 36, py: 0 }} />
          <Tab label="Rejected" sx={{ minHeight: 36, py: 0 }} />
        </Tabs>
        <Typography variant="caption" color="text.secondary">Auto-refreshing every 5s</Typography>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Time', 'Symbol', 'Type', 'Product', 'Side', 'Qty', 'Price', 'Avg Price', 'Status', 'Actions'].map((h) => (
                <TableCell key={h} align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No orders found
                </TableCell>
              </TableRow>
            ) : orders.map((o) => (
              <TableRow key={o.id} hover>
                <TableCell align="center" sx={{ fontSize: '0.72rem' }}>
                  {new Date(o.placed_at).toLocaleTimeString()}
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" fontWeight={700}>{o.symbol}</Typography>
                  <Typography variant="caption" color="text.secondary">{o.exchange}</Typography>
                </TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{o.price_type}</TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{o.product_type}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={o.side}
                    size="small"
                    sx={{
                      bgcolor: o.side === 'BUY' ? '#e3f2fd' : '#ffebee',
                      color: o.side === 'BUY' ? '#1565c0' : '#b71c1c',
                      fontWeight: 700, fontSize: '0.7rem',
                    }}
                  />
                </TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                  {o.quantity}
                  {o.executed_quantity > 0 && o.executed_quantity < o.quantity && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      ({o.executed_quantity} filled)
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                  {o.price ? `₹${Number(o.price).toLocaleString('en-IN')}` : 'MKT'}
                </TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                  {o.average_price ? `₹${Number(o.average_price).toLocaleString('en-IN')}` : '—'}
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={o.status}
                    size="small"
                    color={STATUS_COLORS[o.status] ?? 'default'}
                    sx={{ fontSize: '0.65rem' }}
                  />
                  {o.rejection_reason && (
                    <Tooltip title={o.rejection_reason}>
                      <Typography variant="caption" color="error" display="block" noWrap sx={{ maxWidth: 100 }}>
                        {o.rejection_reason}
                      </Typography>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align="center">
                  {isOpen(o) && (
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title="Modify">
                        <IconButton size="small" onClick={() => setModifyOrder(o)}>
                          <EditIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Cancel">
                        <IconButton size="small" color="error" onClick={() => cancel(o.id)}>
                          <CancelIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                      {o.status === 'OPEN' && (
                        <Tooltip title="Force Execute (dev)">
                          <IconButton size="small" color="success" onClick={() => forceExec(o.id)}>
                            <PlayArrowIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {modifyOrder && <ModifyDialog order={modifyOrder} onClose={() => setModifyOrder(null)} />}
    </Box>
  );
}
