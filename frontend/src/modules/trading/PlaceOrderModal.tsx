import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, TextField, MenuItem, Typography,
  ToggleButton, ToggleButtonGroup, Divider, Alert,
  Chip, CircularProgress,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { tradingService, PlaceOrderPayload, PriceType, ProductType, Validity } from '@/api/trading';
import { brokerService, BrokerCredential, SyncResult } from '@/api/broker';
import { useAppDispatch, useAppSelector } from '@/store';
import { closeOrderModal } from '@/store/tradingSlice';
import { useLivePrice } from '@/hooks/useLivePrice';
import { useMarketSocket } from '@/hooks/useMarketSocket';

const PRICE_TYPES: PriceType[] = ['MARKET', 'LIMIT', 'SL', 'SL_M'];
const PRODUCT_TYPES: { value: ProductType; label: string; desc: string }[] = [
  { value: 'CNC',  label: 'CNC',  desc: 'Delivery (equity only)' },
  { value: 'MIS',  label: 'MIS',  desc: 'Intraday' },
  { value: 'NRML', label: 'NRML', desc: 'Normal (F&O)' },
];
const VALIDITIES: Validity[] = ['DAY', 'IOC', 'TTL'];

const SANDBOX_VALUE = '__sandbox__';

function fmt(v: string | number) {
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PlaceOrderModal() {
  const dispatch = useAppDispatch();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { orderModalOpen, prefillInstrument: instr, prefillSide, prefillClientId } = useAppSelector((s) => s.trading);

  const [side, setSide]             = useState<'BUY' | 'SELL'>('BUY');
  const [priceType, setPriceType]   = useState<PriceType>('MARKET');
  const [product, setProduct]       = useState<ProductType>('CNC');
  const [validity, setValidity]     = useState<Validity>('DAY');
  const [qty, setQty]               = useState('1');
  const [price, setPrice]           = useState('');
  const [trigger, setTrigger]       = useState('');
  const [clientId, setClientId]     = useState('');
  const [credentialId, setCredentialId] = useState(SANDBOX_VALUE);
  const [confirm, setConfirm]       = useState(false);
  const [validationErr, setValidationErr] = useState('');

  // Fetch broker credentials for the selected client
  const { data: credentials = [] } = useQuery<BrokerCredential[]>({
    queryKey: ['broker-credentials', clientId],
    queryFn: () => brokerService.listCredentials(clientId).then(r => r.data),
    enabled: !!clientId,
  });

  const liveCreds = credentials.filter(
    c => c.is_active && !c.is_sandbox && c.has_access_token
  );

  const selectedCred = liveCreds.find(c => c.id === credentialId) ?? null;
  const tokenExpired = selectedCred?.token_expiry
    ? new Date(selectedCred.token_expiry) < new Date()
    : false;
  const isLive = credentialId !== SANDBOX_VALUE;

  // Reset form on open
  useEffect(() => {
    if (orderModalOpen) {
      setSide(prefillSide ?? 'BUY');
      setProduct(instr?.instrument_type === 'EQUITY' ? 'CNC' : 'NRML');
      setPriceType('MARKET');
      setValidity('DAY');
      setQty(instr ? String(instr.lot_size) : '1');
      setPrice('');
      setTrigger('');
      setClientId(prefillClientId ?? '');
      setCredentialId(SANDBOX_VALUE);
      setConfirm(false);
      setValidationErr('');
    }
  }, [orderModalOpen]);

  // Auto-select first live credential when credentials load
  useEffect(() => {
    if (liveCreds.length > 0 && credentialId === SANDBOX_VALUE) {
      setCredentialId(liveCreds[0].id);
    }
  }, [liveCreds.length]);

  useMarketSocket();
  const livePrice = useLivePrice(instr?.symbol ?? null);

  // Subscribe the symbol so ticks start flowing when the modal opens
  useEffect(() => {
    if (instr?.symbol && orderModalOpen) {
      brokerService.subscribeSymbols([instr.symbol]).catch(() => {});
    }
  }, [instr?.symbol, orderModalOpen]);

  const ltp = livePrice?.ltp ?? (instr ? Number(instr.ltp) : 0);
  const estimatedPrice = priceType === 'MARKET' ? ltp : (Number(price) || 0);
  const estimatedCost  = estimatedPrice * Number(qty || '0');

  const validate = (): string => {
    if (!clientId.trim()) return 'Client is required';
    if (!qty || Number(qty) <= 0) return 'Quantity must be > 0';
    if (instr && instr.instrument_type !== 'EQUITY' && Number(qty) % instr.lot_size !== 0)
      return `Quantity must be a multiple of lot size (${instr.lot_size})`;
    if (product === 'CNC' && instr && instr.instrument_type !== 'EQUITY')
      return 'CNC is only for EQUITY instruments';
    if (priceType === 'LIMIT' && (!price || Number(price) <= 0))
      return 'LIMIT orders require price > 0';
    if ((priceType === 'SL' || priceType === 'SL_M') && !trigger)
      return 'SL/SL_M orders require a trigger price';
    if (isLive && tokenExpired)
      return 'Zerodha session expired — re-connect from the client\'s broker account page';
    return '';
  };

  // All orders go through order-service (which routes live orders to broker-service internally)
  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: (payload: PlaceOrderPayload) => tradingService.placeOrder(payload).then(r => r.data),
    onSuccess: (order) => {
      const label = isLive ? `Order sent to Zerodha — ${order.status}` : `Order placed — ${order.status}`;
      enqueueSnackbar(label, { variant: order.status === 'EXECUTED' ? 'success' : 'info' });
      qc.invalidateQueries({ queryKey: ['orders'] });
      dispatch(closeOrderModal());

      // For live orders: sync Zerodha holdings into PMS immediately, then again after 5s
      // so the portfolio updates even if the order hasn't settled yet at first sync
      if (isLive && clientId) {
        const syncAndRefresh = () =>
          brokerService.triggerSync(clientId).then(() => {
            qc.invalidateQueries({ queryKey: ['portfolio'] });
            qc.invalidateQueries({ queryKey: ['aum'] });
            qc.invalidateQueries({ queryKey: ['holdings'] });
            qc.invalidateQueries({ queryKey: ['orders'] });
          }).catch(() => {});

        syncAndRefresh();
        setTimeout(syncAndRefresh, 5000);
      }
    },
    onError: (err: any) => {
      enqueueSnackbar(err?.response?.data?.detail ?? 'Order failed', { variant: 'error' });
      setConfirm(false);
    },
  });

  const handleSubmit = () => {
    const err = validate();
    if (err) { setValidationErr(err); return; }
    if (!confirm) { setConfirm(true); return; }

    placeOrder({
      client_id: clientId.trim(),
      broker: isLive ? 'zerodha' : 'sandbox',
      broker_credential_id: isLive ? credentialId : null,
      symbol: instr?.symbol ?? '',
      exchange: instr?.exchange ?? 'NSE',
      side,
      price_type: priceType,
      product_type: product,
      validity,
      quantity: Number(qty),
      price: priceType !== 'MARKET' && price ? price : null,
      trigger_price: (priceType === 'SL' || priceType === 'SL_M') ? trigger : null,
    });
  };

  const handleClose = () => { dispatch(closeOrderModal()); setConfirm(false); };

  const isBuy = side === 'BUY';
  const buyColor   = '#1565c0';
  const sellColor  = '#b71c1c';
  const activeColor = isBuy ? buyColor : sellColor;

  return (
    <Dialog open={orderModalOpen} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              {instr ? instr.symbol : 'Place Order'}
            </Typography>
            {instr && <Chip label={instr.exchange} size="small" variant="outlined" />}
            {isLive && !tokenExpired && (
              <Chip label="LIVE" size="small" color="success" sx={{ height: 20, fontSize: 10 }} />
            )}
            {isLive && tokenExpired && (
              <Chip label="TOKEN EXPIRED" size="small" color="error" sx={{ height: 20, fontSize: 10 }} />
            )}
          </Box>
          {instr && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {livePrice && (
                <Box sx={{
                  width: 7, height: 7, borderRadius: '50%', bgcolor: '#00e676',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 },
                  },
                }} />
              )}
              <Typography variant="body2" color="text.secondary">
                LTP: <strong style={{ color: livePrice ? '#00e676' : undefined }}>
                  ₹{ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
                {livePrice?.change_pct !== undefined && (
                  <span style={{ fontSize: '0.75rem', color: livePrice.change_pct >= 0 ? '#00e676' : '#ff5252', marginLeft: 6 }}>
                    ({livePrice.change_pct >= 0 ? '+' : ''}{livePrice.change_pct.toFixed(2)}%)
                  </span>
                )}
              </Typography>
            </Box>
          )}
        </Box>

        <ToggleButtonGroup
          value={side} exclusive
          onChange={(_, v) => { if (v) { setSide(v); setConfirm(false); } }}
          sx={{ mt: 1.5, mb: 0.5 }} size="small"
        >
          <ToggleButton value="BUY" sx={{
            px: 4, fontWeight: 700,
            '&.Mui-selected': { bgcolor: buyColor, color: '#fff', '&:hover': { bgcolor: buyColor } },
          }}>BUY</ToggleButton>
          <ToggleButton value="SELL" sx={{
            px: 4, fontWeight: 700,
            '&.Mui-selected': { bgcolor: sellColor, color: '#fff', '&:hover': { bgcolor: sellColor } },
          }}>SELL</ToggleButton>
        </ToggleButtonGroup>
      </DialogTitle>

      <DialogContent dividers>
        {confirm ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" gutterBottom>Confirm Order</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, textAlign: 'left', mb: 2 }}>
              {[
                ['Symbol',   instr?.symbol ?? '—'],
                ['Side',     side],
                ['Type',     `${priceType} / ${product}`],
                ['Qty',      qty],
                ['Price',    priceType === 'MARKET' ? 'MARKET' : `₹${price}`],
                ['Est. Cost', fmt(estimatedCost)],
                ['Route',    isLive ? `Live — ${selectedCred?.display_name ?? 'Zerodha'}` : 'Sandbox (PMS)'],
              ].map(([k, v]) => (
                <Box key={k}>
                  <Typography variant="caption" color="text.secondary">{k}</Typography>
                  <Typography variant="body2" fontWeight={600}>{v}</Typography>
                </Box>
              ))}
            </Box>
            <Alert severity={isLive ? 'warning' : 'info'} sx={{ textAlign: 'left' }}>
              {isLive
                ? 'This order will be placed on your LIVE Zerodha account. Real money will be used.'
                : 'This is a sandbox order — no real money involved.'}
            </Alert>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {validationErr && (
              <Alert severity="error" onClose={() => setValidationErr('')}>{validationErr}</Alert>
            )}

            {/* Broker / Route selector */}
            <TextField
              select fullWidth size="small" label="Route Order Via"
              value={credentialId}
              onChange={(e) => { setCredentialId(e.target.value); setConfirm(false); }}
            >
              <MenuItem value={SANDBOX_VALUE}>
                <Box>
                  <Typography variant="body2">Sandbox (PMS)</Typography>
                  <Typography variant="caption" color="text.secondary">Simulated — no real money</Typography>
                </Box>
              </MenuItem>
              {liveCreds.map((c) => {
                const expired = c.token_expiry ? new Date(c.token_expiry) < new Date() : false;
                return (
                  <MenuItem key={c.id} value={c.id} disabled={expired}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2">{c.display_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.broker.toUpperCase()} · {c.account_id}
                        </Typography>
                      </Box>
                      {expired
                        ? <Chip label="Expired" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
                        : <Chip label="Live" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />
                      }
                    </Box>
                  </MenuItem>
                );
              })}
            </TextField>

            {/* Order type row */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                select label="Order Type" size="small" value={priceType}
                onChange={(e) => { setPriceType(e.target.value as PriceType); setConfirm(false); }}
                sx={{ flex: 1 }}
              >
                {PRICE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>

              <TextField
                select label="Product" size="small" value={product}
                onChange={(e) => setProduct(e.target.value as ProductType)}
                sx={{ flex: 1 }}
              >
                {PRODUCT_TYPES
                  .filter((p) => p.value !== 'CNC' || !instr || instr.instrument_type === 'EQUITY')
                  .map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      <Box>
                        <Typography variant="body2">{p.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.desc}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
              </TextField>

              <TextField
                select label="Validity" size="small" value={validity}
                onChange={(e) => setValidity(e.target.value as Validity)}
                sx={{ flex: 1 }}
              >
                {VALIDITIES.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Box>

            {/* Qty + Price row */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="Quantity" size="small" type="number" value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputProps={{ min: 1 }} sx={{ flex: 1 }}
                helperText={instr && instr.instrument_type !== 'EQUITY' ? `Lot size: ${instr.lot_size}` : undefined}
              />
              <TextField
                label="Price (₹)" size="small" type="number" value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={priceType === 'MARKET'}
                placeholder={priceType === 'MARKET' ? 'Market price' : 'Enter price'}
                sx={{ flex: 1 }}
              />
              {(priceType === 'SL' || priceType === 'SL_M') && (
                <TextField
                  label="Trigger Price" size="small" type="number" value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  sx={{ flex: 1 }}
                />
              )}
            </Box>

            <Divider />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">Estimated Value</Typography>
              <Typography variant="body1" fontWeight={700} color={activeColor}>
                {estimatedCost > 0 ? fmt(estimatedCost) : '—'}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={isPending}>Cancel</Button>
        {confirm && <Button onClick={() => setConfirm(false)} disabled={isPending}>Back</Button>}
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isPending || (isLive && tokenExpired)}
          sx={{ bgcolor: activeColor, '&:hover': { bgcolor: activeColor, filter: 'brightness(0.9)' }, minWidth: 120 }}
        >
          {isPending
            ? <CircularProgress size={18} color="inherit" />
            : confirm
              ? `Confirm ${side}`
              : `Review ${side}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
