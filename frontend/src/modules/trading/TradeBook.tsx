import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Typography, CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { tradingService } from '@/api/trading';

interface Props {
  clientId?: string;
}

export default function TradeBook({ clientId }: Props) {
  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades', clientId],
    queryFn: () => tradingService.listTrades({ client_id: clientId, size: 100 }).then((r) => r.data),
    refetchInterval: 10000,
  });

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Trade Time', 'Symbol', 'Exchange', 'Side', 'Product', 'Fill Qty', 'Fill Price', 'Order ID'].map((h) => (
              <TableCell key={h} align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell>
            </TableRow>
          ) : trades.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No trades yet</TableCell>
            </TableRow>
          ) : trades.map((t) => (
            <TableRow key={t.id} hover>
              <TableCell align="center" sx={{ fontSize: '0.72rem' }}>
                {new Date(t.traded_at).toLocaleString()}
              </TableCell>
              <TableCell align="center">
                <Typography variant="body2" fontWeight={700}>{t.symbol}</Typography>
              </TableCell>
              <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{t.exchange}</TableCell>
              <TableCell align="center">
                <Chip
                  label={t.side}
                  size="small"
                  sx={{
                    bgcolor: t.side === 'BUY' ? '#e3f2fd' : '#ffebee',
                    color: t.side === 'BUY' ? '#1565c0' : '#b71c1c',
                    fontWeight: 700, fontSize: '0.7rem',
                  }}
                />
              </TableCell>
              <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{t.product_type}</TableCell>
              <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{t.fill_qty}</TableCell>
              <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                ₹{Number(t.fill_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell align="center">
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                  {t.order_id.slice(0, 8)}…
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
