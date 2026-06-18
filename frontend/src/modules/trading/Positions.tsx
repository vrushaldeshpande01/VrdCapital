import { useState } from 'react';
import {
  Box, ToggleButton, ToggleButtonGroup, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Typography, CircularProgress,
  IconButton, Tooltip,
} from '@mui/material';
import CallMadeIcon from '@mui/icons-material/CallMade';
import { useQuery } from '@tanstack/react-query';
import { tradingService } from '@/api/trading';
import { useAppDispatch } from '@/store';
import { openOrderModal } from '@/store/tradingSlice';

interface Props {
  clientId: string;
}

function pnlColor(v: number) {
  return v >= 0 ? '#2e7d32' : '#c62828';
}

function fmt(v: string | number) {
  return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Positions({ clientId }: Props) {
  const dispatch = useAppDispatch();
  const [posType, setPosType] = useState<'day' | 'net'>('day');

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions', clientId, posType],
    queryFn: () => tradingService.getPositions(clientId, posType).then((r) => r.data),
    enabled: !!clientId,
    refetchInterval: 5000,
  });

  const handleExit = (symbol: string, exchange: string, ltp: string) => {
    dispatch(openOrderModal({
      instrument: {
        id: symbol,
        symbol,
        name: symbol,
        exchange,
        instrument_type: 'EQUITY',
        lot_size: 1,
        tick_size: '0.05',
        ltp,
      },
      side: 'SELL',
      clientId,
    }));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <ToggleButtonGroup
          value={posType}
          exclusive
          onChange={(_, v) => { if (v) setPosType(v); }}
          size="small"
        >
          <ToggleButton value="day" sx={{ px: 3, fontWeight: 600 }}>Day Positions</ToggleButton>
          <ToggleButton value="net" sx={{ px: 3, fontWeight: 600 }}>Net Positions</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Symbol', 'Product', 'Net Qty', 'Avg Buy', 'Avg Sell', 'LTP', 'Unrealized P&L', 'Realized P&L', 'Action'].map((h) => (
                <TableCell key={h} align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell>
              </TableRow>
            ) : positions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No {posType} positions
                </TableCell>
              </TableRow>
            ) : positions.map((p) => {
              const uPnl = Number(p.unrealized_pnl);
              const rPnl = Number(p.realized_pnl);
              return (
                <TableRow key={`${p.symbol}-${p.product_type}`} hover>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700}>{p.symbol}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.exchange}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={p.product_type} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                  </TableCell>
                  <TableCell align="center">
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      color={p.net_qty > 0 ? '#1565c0' : p.net_qty < 0 ? '#b71c1c' : 'text.primary'}
                    >
                      {p.net_qty > 0 ? `+${p.net_qty}` : p.net_qty}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.75rem' }}>₹{fmt(p.avg_buy_price)}</TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                    {Number(p.avg_sell_price) > 0 ? `₹${fmt(p.avg_sell_price)}` : '—'}
                  </TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>₹{fmt(p.ltp)}</TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700} color={pnlColor(uPnl)}>
                      {uPnl >= 0 ? '+' : ''}₹{fmt(uPnl)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700} color={pnlColor(rPnl)}>
                      {rPnl >= 0 ? '+' : ''}₹{fmt(rPnl)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {p.is_open && (
                      <Tooltip title="Exit position (place reverse MARKET order)">
                        <IconButton size="small" color="warning" onClick={() => handleExit(p.symbol, p.exchange, String(p.ltp))}>
                          <CallMadeIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
