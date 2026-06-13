import { useState } from 'react';
import {
  Box, Typography, Tabs, Tab, TextField, MenuItem, Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery } from '@tanstack/react-query';
import { clientsService } from '@/api/clients';
import type { Client } from '@/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { openOrderModal } from '@/store/tradingSlice';

import InstrumentSearchBar from '@/modules/trading/InstrumentSearchBar';
import FundsWidget from '@/modules/trading/FundsWidget';
import OrderBook from '@/modules/trading/OrderBook';
import TradeBook from '@/modules/trading/TradeBook';
import Positions from '@/modules/trading/Positions';
import Holdings from '@/modules/trading/Holdings';
import PlaceOrderModal from '@/modules/trading/PlaceOrderModal';

const TABS = ['Orders', 'Trades', 'Positions', 'Holdings'];

export default function TradingPage() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState('');

  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientsService.list({ page: 1, size: 200 }),
  });
  const clients = clientsData?.items ?? [];

  const clientId = selectedClientId || clients[0]?.id || '';

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Trading</Typography>
          <Typography variant="body2" color="text.secondary">
            Place and manage orders — Zerodha-style order management
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* Client selector */}
          <TextField
            select
            size="small"
            label="Client"
            value={clientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {clients.map((c: Client) => (
              <MenuItem key={c.id} value={c.id}>
                {c.full_name}
              </MenuItem>
            ))}
          </TextField>

          {/* Instrument search → opens PlaceOrderModal */}
          <InstrumentSearchBar clientId={clientId} />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => dispatch(openOrderModal({ clientId }))}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Place Order
          </Button>
        </Box>
      </Box>

      {/* Funds widget */}
      {clientId && (
        <Box sx={{ mb: 2 }}>
          <FundsWidget clientId={clientId} />
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          {TABS.map((label) => <Tab key={label} label={label} />)}
        </Tabs>
      </Box>

      {tab === 0 && <OrderBook clientId={clientId} />}
      {tab === 1 && <TradeBook clientId={clientId} />}
      {tab === 2 && clientId && <Positions clientId={clientId} />}
      {tab === 3 && clientId && <Holdings clientId={clientId} />}

      {/* Global order modal — mounts once, controlled by Redux */}
      <PlaceOrderModal />
    </Box>
  );
}
