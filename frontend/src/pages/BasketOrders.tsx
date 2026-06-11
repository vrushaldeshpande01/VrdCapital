import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Grid,
  Stepper, Step, StepLabel, TextField, MenuItem, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, Alert, Divider,
} from '@mui/material';
import { Add, Delete, PlayArrow, Save } from '@mui/icons-material';

const MOCK_BASKETS = [
  { id: '1', name: 'Nifty50 Rebalance', orders: 8, clients: 12, status: 'COMPLETED', created: '2026-06-10', value: '₹48.2 L' },
  { id: '2', name: 'IT Sector Buy', orders: 4, clients: 5, status: 'PENDING', created: '2026-06-11', value: '₹12.8 L' },
  { id: '3', name: 'Banking Sector Trim', orders: 6, clients: 8, status: 'EXECUTING', created: '2026-06-11', value: '₹31.5 L' },
];

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default' | 'info'> = {
  COMPLETED: 'success', PENDING: 'warning', EXECUTING: 'info', DRAFT: 'default',
};

const STEPS = ['Define Basket', 'Select Clients', 'Review & Execute'];

export default function BasketOrdersPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [orders, setOrders] = useState([
    { symbol: 'RELIANCE', type: 'BUY', quantity: 10, price_type: 'MARKET' },
    { symbol: 'TCS', type: 'BUY', quantity: 5, price_type: 'MARKET' },
  ]);

  const addOrder = () => setOrders(o => [...o, { symbol: '', type: 'BUY', quantity: 1, price_type: 'MARKET' }]);
  const removeOrder = (i: number) => setOrders(o => o.filter((_, idx) => idx !== i));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Basket Orders</Typography>
          <Typography variant="body2" color="text.secondary">
            Execute the same set of orders across multiple clients simultaneously
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setShowCreate(true)} sx={{ borderRadius: 2 }}>
          New Basket
        </Button>
      </Box>

      {showCreate && (
        <Card sx={{ mb: 3, border: '2px solid', borderColor: 'primary.light' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>Create New Basket Order</Typography>
            <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
              {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {activeStep === 0 && (
              <Box>
                <TextField fullWidth label="Basket Name" size="small" defaultValue="New Basket" sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Orders</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Price Type</TableCell>
                      <TableCell width={40} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.map((order, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <TextField size="small" value={order.symbol}
                            onChange={(e) => setOrders(o => o.map((x, idx) => idx === i ? { ...x, symbol: e.target.value } : x))}
                            sx={{ width: 120 }} />
                        </TableCell>
                        <TableCell>
                          <TextField select size="small" value={order.type}
                            onChange={(e) => setOrders(o => o.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x))}
                            sx={{ width: 90 }}>
                            <MenuItem value="BUY">BUY</MenuItem>
                            <MenuItem value="SELL">SELL</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" value={order.quantity}
                            onChange={(e) => setOrders(o => o.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) } : x))}
                            sx={{ width: 90 }} />
                        </TableCell>
                        <TableCell>
                          <TextField select size="small" value={order.price_type}
                            onChange={(e) => setOrders(o => o.map((x, idx) => idx === i ? { ...x, price_type: e.target.value } : x))}
                            sx={{ width: 110 }}>
                            <MenuItem value="MARKET">MARKET</MenuItem>
                            <MenuItem value="LIMIT">LIMIT</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => removeOrder(i)}><Delete fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button size="small" startIcon={<Add />} onClick={addOrder} sx={{ mt: 1 }}>Add Order</Button>
              </Box>
            )}

            {activeStep === 1 && (
              <Alert severity="info">Client selection will connect to the Client Service in the full implementation. Select which clients to apply this basket to.</Alert>
            )}

            {activeStep === 2 && (
              <Box>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  You are about to execute {orders.length} orders across selected clients. This action cannot be undone.
                </Alert>
                <Typography variant="body2">Basket summary: {orders.length} symbols, {orders.filter(o => o.type === 'BUY').length} BUY / {orders.filter(o => o.type === 'SELL').length} SELL</Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowCreate(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
              {activeStep > 0 && <Button onClick={() => setActiveStep(s => s - 1)} sx={{ borderRadius: 2 }}>Back</Button>}
              {activeStep < 2
                ? <Button variant="contained" onClick={() => setActiveStep(s => s + 1)} sx={{ borderRadius: 2 }}>Next</Button>
                : <Button variant="contained" color="success" startIcon={<PlayArrow />} sx={{ borderRadius: 2 }}>Execute Basket</Button>
              }
            </Box>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[{ label: 'Total Baskets', val: 3 }, { label: 'Executing', val: 1 }, { label: 'Completed Today', val: 1 }].map(s => (
          <Grid item xs={4} key={s.label}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="h4" fontWeight={700}>{s.val}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Basket History</Typography>
          <Table>
            <TableHead>
              <TableRow>
                {['Name', 'Orders', 'Clients', 'Est. Value', 'Status', 'Created'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {MOCK_BASKETS.map(b => (
                <TableRow key={b.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{b.name}</TableCell>
                  <TableCell>{b.orders}</TableCell>
                  <TableCell>{b.clients}</TableCell>
                  <TableCell>{b.value}</TableCell>
                  <TableCell>
                    <Chip label={b.status} size="small" color={STATUS_COLOR[b.status] || 'default'} sx={{ height: 20, fontSize: 11 }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{b.created}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
