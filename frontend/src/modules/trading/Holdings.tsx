import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { tradingService } from '@/api/trading';

interface Props {
  clientId: string;
}

function pnlColor(v: number) {
  return v >= 0 ? '#2e7d32' : '#c62828';
}

function fmt(v: string | number) {
  return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Holdings({ clientId }: Props) {
  const { data: holdings = [], isLoading } = useQuery({
    queryKey: ['trading-holdings', clientId],
    queryFn: () => tradingService.getHoldings(clientId).then((r) => r.data),
    enabled: !!clientId,
    refetchInterval: 15000,
  });

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Symbol', 'Exchange', 'Qty', 'Avg Buy Price', 'LTP', 'Current Value', 'Invested Value', 'P&L', 'P&L %'].map((h) => (
              <TableCell key={h} align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell>
            </TableRow>
          ) : holdings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No holdings — place a CNC BUY order to build your portfolio
              </TableCell>
            </TableRow>
          ) : holdings.map((h) => {
            const pnl = Number(h.pnl);
            const pnlPct = Number(h.pnl_pct);
            return (
              <TableRow key={h.symbol} hover>
                <TableCell align="center">
                  <Typography variant="body2" fontWeight={700}>{h.symbol}</Typography>
                </TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{h.exchange}</TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{h.quantity}</TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>₹{fmt(h.avg_buy_price)}</TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>₹{fmt(h.ltp)}</TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  ₹{fmt(h.current_value)}
                </TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>₹{fmt(h.invested_value)}</TableCell>
                <TableCell align="center">
                  <Typography variant="body2" fontWeight={700} color={pnlColor(pnl)}>
                    {pnl >= 0 ? '+' : ''}₹{fmt(pnl)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" fontWeight={700} color={pnlColor(pnlPct)}>
                    {pnlPct >= 0 ? '+' : ''}{fmt(pnlPct)}%
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
