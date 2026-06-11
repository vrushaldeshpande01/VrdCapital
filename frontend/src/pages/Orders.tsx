import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, TextField,
  InputAdornment, Grid, MenuItem, Tabs, Tab,
} from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import {
  DataGrid, GridColDef,
} from '@mui/x-data-grid';

const MOCK_ORDERS = [
  { id: '1', client: 'Rajesh Kumar', symbol: 'RELIANCE', exchange: 'NSE', type: 'BUY', quantity: 50, price: 2485.60, status: 'EXECUTED', broker: 'Zerodha', time: '2026-06-11 10:32:00' },
  { id: '2', client: 'Priya Sharma', symbol: 'TCS', exchange: 'NSE', type: 'SELL', quantity: 25, price: 3892.40, status: 'EXECUTED', broker: 'Upstox', time: '2026-06-11 11:05:00' },
  { id: '3', client: 'Amit Patel', symbol: 'HDFCBANK', exchange: 'NSE', type: 'BUY', quantity: 30, price: 1672.80, status: 'PENDING', broker: 'AngelOne', time: '2026-06-11 11:48:00' },
  { id: '4', client: 'Sneha Joshi', symbol: 'INFY', exchange: 'NSE', type: 'BUY', quantity: 100, price: 1458.20, status: 'EXECUTED', broker: 'Zerodha', time: '2026-06-11 12:15:00' },
  { id: '5', client: 'Vikram Singh', symbol: 'WIPRO', exchange: 'NSE', type: 'SELL', quantity: 75, price: 485.60, status: 'CANCELLED', broker: 'Upstox', time: '2026-06-11 14:22:00' },
  { id: '6', client: 'Meera Nair', symbol: 'BAJFINANCE', exchange: 'NSE', type: 'BUY', quantity: 10, price: 6890.40, status: 'REJECTED', broker: 'Zerodha', time: '2026-06-11 14:45:00' },
];

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  EXECUTED: 'success', PENDING: 'warning', CANCELLED: 'error', REJECTED: 'error',
};

const columns: GridColDef[] = [
  { field: 'client', headerName: 'Client', flex: 1, minWidth: 140 },
  { field: 'symbol', headerName: 'Symbol', width: 110, renderCell: ({ value }) => <Typography fontWeight={700} fontSize={13}>{value}</Typography> },
  { field: 'exchange', headerName: 'Exch', width: 70 },
  {
    field: 'type', headerName: 'Type', width: 80,
    renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'BUY' ? 'success' : 'error'} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />,
  },
  { field: 'quantity', headerName: 'Qty', width: 80, type: 'number' },
  { field: 'price', headerName: 'Price', width: 110, renderCell: ({ value }) => `₹${Number(value).toLocaleString('en-IN')}` },
  {
    field: 'value', headerName: 'Value', width: 120,
    renderCell: ({ row }) => `₹${(row.quantity * row.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
  },
  { field: 'broker', headerName: 'Broker', width: 100 },
  {
    field: 'status', headerName: 'Status', width: 110,
    renderCell: ({ value }) => <Chip label={value} size="small" color={STATUS_COLOR[value] || 'default'} variant="outlined" sx={{ height: 20, fontSize: 11 }} />,
  },
  { field: 'time', headerName: 'Time', width: 160, renderCell: ({ value }) => <Typography fontSize={12} color="text.secondary">{value}</Typography> },
];

export default function OrdersPage() {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');

  const filtered = MOCK_ORDERS.filter(o =>
    o.client.toLowerCase().includes(search.toLowerCase()) ||
    o.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Total Orders', value: MOCK_ORDERS.length, color: '#1a237e' },
    { label: 'Executed', value: MOCK_ORDERS.filter(o => o.status === 'EXECUTED').length, color: '#2e7d32' },
    { label: 'Pending', value: MOCK_ORDERS.filter(o => o.status === 'PENDING').length, color: '#e65100' },
    { label: 'Cancelled', value: MOCK_ORDERS.filter(o => o.status === 'CANCELLED').length, color: '#c62828' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Orders</Typography>
          <Typography variant="body2" color="text.secondary">Manage and track all trade orders</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} sx={{ borderRadius: 2 }}>
          Place Order
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map((s) => (
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
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
            <Tab label="All Orders" />
            <Tab label="Today" />
            <Tab label="Pending" />
          </Tabs>
        </Box>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search client or symbol..."
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ width: 280, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField select size="small" defaultValue="all" sx={{ width: 130, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="buy">BUY</MenuItem>
              <MenuItem value="sell">SELL</MenuItem>
            </TextField>
            <TextField select size="small" defaultValue="all" sx={{ width: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <MenuItem value="all">All Brokers</MenuItem>
              <MenuItem value="zerodha">Zerodha</MenuItem>
              <MenuItem value="upstox">Upstox</MenuItem>
              <MenuItem value="angelone">AngelOne</MenuItem>
            </TextField>
          </Box>
          <DataGrid
            rows={filtered}
            columns={columns}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: 'none', '& .MuiDataGrid-cell': { borderBottom: '1px solid #f5f5f5' }, '& .MuiDataGrid-columnHeaders': { bgcolor: '#fafafa' } }}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
