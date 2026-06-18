import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip,
  Stepper, Step, StepLabel, Grid, TextField, MenuItem,
  Table, TableHead, TableRow, TableCell, TableBody,
  Checkbox, FormControlLabel, Alert, CircularProgress,
  Divider, IconButton, Tooltip,
} from '@mui/material';
import { Add, Delete, PlayArrow } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { ordersService, BasketItem, OrderSide, PriceType } from '@/api/orders';
import { clientsService } from '@/api/clients';

const STEPS = ['Define Basket', 'Select Clients', 'Review & Execute'];

const EMPTY_ITEM = (): BasketItem & { id: number } => ({
  id: Date.now(),
  symbol: '', exchange: 'NSE',
  side: 'BUY' as OrderSide,
  price_type: 'MARKET' as PriceType,
  quantity: 1, price: undefined,
});

export default function BasketOrdersPage() {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [basketName, setBasketName] = useState('');
  const [basketDesc, setBasketDesc] = useState('');
  const [items, setItems] = useState([EMPTY_ITEM()]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [createdBasketId, setCreatedBasketId] = useState<string | null>(null);

  const { data: clientList, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', 1, ''],
    queryFn: () => clientsService.list({ page: 1, size: 100 }),
    enabled: step === 1,
  });
  const clients = clientList?.items || [];

  const { data: pastBaskets, isLoading: basketsLoading } = useQuery({
    queryKey: ['baskets'],
    queryFn: () => ordersService.listBaskets().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => ordersService.createBasket({
      name: basketName,
      description: basketDesc || undefined,
      items: items.map(({ id, ...i }) => ({ ...i, price: i.price_type !== 'MARKET' && i.price ? String(i.price) : undefined })),
    }),
    onSuccess: (res) => {
      setCreatedBasketId(res.data.id);
      setStep(2);
      enqueueSnackbar('Basket created. Review and execute below.', { variant: 'success' });
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || 'Failed to create basket', { variant: 'error' }),
  });

  const executeMutation = useMutation({
    mutationFn: () => ordersService.executeBasket(createdBasketId!, selectedClients),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baskets'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      enqueueSnackbar(`Basket executing for ${selectedClients.length} client(s) — ${items.length * selectedClients.length} orders placed`, { variant: 'success' });
      setStep(0);
      setBasketName(''); setBasketDesc(''); setItems([EMPTY_ITEM()]);
      setSelectedClients([]); setCreatedBasketId(null);
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || 'Execution failed', { variant: 'error' }),
  });

  const updateItem = (id: number, key: string, value: string | number) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i));

  const removeItem = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  const toggleClient = (id: string) =>
    setSelectedClients(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const step1Valid = basketName.trim() && items.every(i => i.symbol && i.quantity > 0);
  const step2Valid = selectedClients.length > 0;

  return (
    <Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={step} sx={{ mb: 3 }}>
            {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {/* Step 0: Define Basket */}
          {step === 0 && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth size="small" label="Basket Name *" required value={basketName}
                    onChange={e => setBasketName(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth size="small" label="Description (optional)" value={basketDesc}
                    onChange={e => setBasketDesc(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
              </Grid>

              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Basket Items</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fafafa' }}>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Exchange</TableCell>
                    <TableCell>Side</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Limit Price</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <TextField size="small" placeholder="RELIANCE" value={item.symbol}
                          onChange={e => updateItem(item.id, 'symbol', e.target.value.toUpperCase())}
                          sx={{ width: 110 }} />
                      </TableCell>
                      <TableCell>
                        <TextField select size="small" value={item.exchange}
                          onChange={e => updateItem(item.id, 'exchange', e.target.value)}
                          sx={{ width: 80 }}>
                          <MenuItem value="NSE">NSE</MenuItem>
                          <MenuItem value="BSE">BSE</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField select size="small" value={item.side}
                          onChange={e => updateItem(item.id, 'side', e.target.value)}
                          sx={{ width: 80 }}>
                          <MenuItem value="BUY">BUY</MenuItem>
                          <MenuItem value="SELL">SELL</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField select size="small" value={item.price_type}
                          onChange={e => updateItem(item.id, 'price_type', e.target.value)}
                          sx={{ width: 100 }}>
                          <MenuItem value="MARKET">MARKET</MenuItem>
                          <MenuItem value="LIMIT">LIMIT</MenuItem>
                          <MenuItem value="SL">SL</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={item.quantity}
                          onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                          sx={{ width: 80 }} />
                      </TableCell>
                      <TableCell>
                        {item.price_type !== 'MARKET' ? (
                          <TextField size="small" type="number" placeholder="₹ price"
                            value={item.price ?? ''}
                            onChange={e => updateItem(item.id, 'price', e.target.value)}
                            sx={{ width: 110 }} />
                        ) : (
                          <Typography color="text.disabled" fontSize={13}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Remove">
                          <span>
                            <IconButton size="small" color="error" disabled={items.length === 1}
                              onClick={() => removeItem(item.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button size="small" startIcon={<Add />} onClick={() => setItems(p => [...p, EMPTY_ITEM()])}>
                  Add Symbol
                </Button>
                <Button variant="contained" disabled={!step1Valid} onClick={() => setStep(1)} sx={{ borderRadius: 2 }}>
                  Next: Select Clients
                </Button>
              </Box>
            </Box>
          )}

          {/* Step 1: Select Clients */}
          {step === 1 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                Select clients to execute this basket for
              </Typography>
              {clientsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : clients.length === 0 ? (
                <Alert severity="warning">No clients found. Add clients first.</Alert>
              ) : (
                <>
                  <FormControlLabel
                    label={<Typography fontWeight={600}>Select All ({clients.length})</Typography>}
                    control={
                      <Checkbox
                        checked={selectedClients.length === clients.length}
                        indeterminate={selectedClients.length > 0 && selectedClients.length < clients.length}
                        onChange={() => setSelectedClients(
                          selectedClients.length === clients.length ? [] : clients.map(c => c.id)
                        )}
                      />
                    }
                    sx={{ mb: 1, display: 'flex' }}
                  />
                  <Divider sx={{ mb: 1 }} />
                  <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                    {clients.map(c => (
                      <FormControlLabel
                        key={c.id}
                        label={
                          <Box>
                            <Typography fontSize={14} fontWeight={600}>{c.full_name}</Typography>
                            <Typography fontSize={12} color="text.secondary">{c.email}</Typography>
                          </Box>
                        }
                        control={<Checkbox checked={selectedClients.includes(c.id)} onChange={() => toggleClient(c.id)} />}
                        sx={{ display: 'flex', mb: 0.5, '& .MuiFormControlLabel-label': { flexGrow: 1 } }}
                      />
                    ))}
                  </Box>
                </>
              )}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={() => setStep(0)} sx={{ borderRadius: 2 }}>Back</Button>
                <Button variant="contained" disabled={!step2Valid || createMutation.isPending} onClick={() => createMutation.mutate()}
                  sx={{ borderRadius: 2 }}>
                  {createMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Create Basket'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Step 2: Review & Execute */}
          {step === 2 && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Basket "<strong>{basketName}</strong>" created with {items.length} symbol(s).
              </Alert>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Summary</Typography>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid item xs={4}>
                  <Card variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Symbols</Typography>
                    <Typography variant="h5" fontWeight={700}>{items.length}</Typography>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Clients</Typography>
                    <Typography variant="h5" fontWeight={700}>{selectedClients.length}</Typography>
                  </Card>
                </Grid>
                <Grid item xs={4}>
                  <Card variant="outlined" sx={{ p: 1.5, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Total Orders</Typography>
                    <Typography variant="h5" fontWeight={700}>{items.length * selectedClients.length}</Typography>
                  </Card>
                </Grid>
              </Grid>

              <Table size="small" sx={{ mb: 2 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fafafa' }}>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Side</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((i, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Typography fontWeight={700} component="span">{i.symbol}</Typography>
                        <Typography component="span" fontSize={11} color="text.secondary" sx={{ ml: 0.5 }}>{i.exchange}</Typography>
                      </TableCell>
                      <TableCell><Chip label={i.side} size="small" color={i.side === 'BUY' ? 'success' : 'error'} sx={{ height: 20, fontSize: 11 }} /></TableCell>
                      <TableCell>{i.price_type}</TableCell>
                      <TableCell>{i.quantity}</TableCell>
                      <TableCell>{i.price_type !== 'MARKET' && i.price ? `₹${i.price}` : 'MARKET'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={() => setStep(1)} sx={{ borderRadius: 2 }}>Back</Button>
                <Button variant="contained" color="success" startIcon={executeMutation.isPending ? undefined : <PlayArrow />}
                  onClick={() => executeMutation.mutate()}
                  disabled={executeMutation.isPending}
                  sx={{ borderRadius: 2 }}>
                  {executeMutation.isPending ? <CircularProgress size={18} color="inherit" /> : `Execute for ${selectedClients.length} Client(s)`}
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Past Baskets */}
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>Basket History</Typography>
      {basketsLoading ? <CircularProgress size={24} /> : (
        <Grid container spacing={2}>
          {(pastBaskets || []).length === 0 && (
            <Grid item xs={12}>
              <Alert severity="info">No baskets yet. Create your first basket above.</Alert>
            </Grid>
          )}
          {(pastBaskets || []).map(b => (
            <Grid item xs={12} md={6} key={b.id}>
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography fontWeight={700}>{b.name}</Typography>
                      {b.description && <Typography fontSize={12} color="text.secondary">{b.description}</Typography>}
                    </Box>
                    <Chip label={b.status} size="small"
                      color={b.status === 'COMPLETED' ? 'success' : b.status === 'FAILED' ? 'error' : b.status === 'EXECUTING' ? 'warning' : 'default'}
                      variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  </Box>
                  <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                    <Typography fontSize={12} color="text.secondary">
                      {b.executed_orders}/{b.total_orders} executed
                    </Typography>
                    {b.failed_orders > 0 && <Typography fontSize={12} color="error">{b.failed_orders} failed</Typography>}
                  </Box>
                  <Typography fontSize={11} color="text.disabled" sx={{ mt: 0.5 }}>
                    {new Date(b.created_at).toLocaleString('en-IN')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
