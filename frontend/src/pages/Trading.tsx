import { useState } from 'react';
import {
  Box, Typography, Tabs, Tab, TextField, MenuItem, Button, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery } from '@tanstack/react-query';
import { clientsService } from '@/api/clients';
import type { Client } from '@/types';
import { useAppDispatch } from '@/store';
import { openOrderModal } from '@/store/tradingSlice';

import InstrumentSearchBar from '@/modules/trading/InstrumentSearchBar';
import FundsWidget from '@/modules/trading/FundsWidget';
import OrderBook from '@/modules/trading/OrderBook';
import TradeBook from '@/modules/trading/TradeBook';
import Positions from '@/modules/trading/Positions';
import Holdings from '@/modules/trading/Holdings';
import PlaceOrderModal from '@/modules/trading/PlaceOrderModal';
import BasketOrdersPage from '@/pages/BasketOrders';

const TABS = ['Orders', 'Trades', 'Positions', 'Holdings', 'Basket'];

const ALL_CLIENTS = '__all__';

export default function TradingPage() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState(ALL_CLIENTS);

  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientsService.list({ page: 1, size: 100 }),
  });
  const clients = clientsData?.items ?? [];

  // undefined = fetch all; a real ID = filter to that client
  const clientId = selectedClientId === ALL_CLIENTS ? undefined : selectedClientId;
  const needsClient = !clientId;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Trading Terminal</Typography>
          <Typography variant="body2" color="text.secondary">
            Place orders, track positions and manage your basket — live
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* Client selector */}
          <TextField
            select
            size="small"
            label="Client"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value={ALL_CLIENTS}>All Clients</MenuItem>
            {clients.map((c: Client) => (
              <MenuItem key={c.id} value={c.id}>
                {c.full_name}
              </MenuItem>
            ))}
          </TextField>

          {/* Instrument search → opens PlaceOrderModal. Disabled in "all clients" mode */}
          {clientId && <InstrumentSearchBar clientId={clientId} />}

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!clientId}
            onClick={() => dispatch(openOrderModal({ clientId }))}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Place Order
          </Button>
        </Box>
      </Box>

      {/* Funds widget — only when a specific client is selected */}
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
      {tab === 2 && (
        needsClient
          ? <Alert severity="info">Select a client to view positions.</Alert>
          : <Positions clientId={clientId!} />
      )}
      {tab === 3 && (
        needsClient
          ? <Alert severity="info">Select a client to view holdings.</Alert>
          : <Holdings clientId={clientId!} />
      )}
      {tab === 4 && <BasketOrdersPage />}

      {/* Global order modal — mounts once, controlled by Redux */}
      <PlaceOrderModal />
    </Box>
  );
}
