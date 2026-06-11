import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, TextField,
  InputAdornment, Chip, IconButton, Tooltip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, MenuItem, CircularProgress, Alert,
} from '@mui/material';
import {
  Search, Add, Edit, Delete, Visibility,
  CheckCircle, Cancel, FilterList,
} from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { clientsService, CreateClientPayload } from '@/api/clients';
import type { Client } from '@/types';

const RISK_COLORS: Record<string, 'success' | 'warning' | 'error'> = {
  conservative: 'success',
  moderate: 'warning',
  aggressive: 'error',
};

const STATUS_COLORS: Record<string, 'success' | 'default' | 'error' | 'warning'> = {
  active: 'success',
  inactive: 'default',
  suspended: 'error',
  onboarding: 'warning',
};

function CreateClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<Partial<CreateClientPayload>>({
    risk_profile: 'moderate',
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: (payload: CreateClientPayload) => clientsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-stats'] });
      enqueueSnackbar('Client created successfully', { variant: 'success' });
      onClose();
      setForm({ risk_profile: 'moderate' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate(form as CreateClientPayload);
  };

  const field = (label: string, key: keyof CreateClientPayload, type = 'text', required = false) => (
    <TextField
      fullWidth
      label={label}
      type={type}
      required={required}
      value={form[key] || ''}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      size="small"
      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Client</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(error as any)?.response?.data?.detail || 'Failed to create client'}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>{field('Full Name', 'full_name', 'text', true)}</Grid>
            <Grid item xs={12} sm={6}>{field('Email', 'email', 'email', true)}</Grid>
            <Grid item xs={12} sm={6}>{field('Phone', 'phone', 'tel', true)}</Grid>
            <Grid item xs={12} sm={6}>{field('PAN Number', 'pan_number')}</Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth select label="Risk Profile" size="small"
                value={form.risk_profile || 'moderate'}
                onChange={(e) => setForm((f) => ({ ...f, risk_profile: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              >
                <MenuItem value="conservative">Conservative</MenuItem>
                <MenuItem value="moderate">Moderate</MenuItem>
                <MenuItem value="aggressive">Aggressive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>{field('Annual Income (₹)', 'annual_income', 'number')}</Grid>
            <Grid item xs={12} sm={6}>{field('Investment Horizon (Years)', 'investment_horizon_years', 'number')}</Grid>
            <Grid item xs={12}>{field('Investment Goal', 'investment_goal')}</Grid>
            <Grid item xs={12}>{field('Notes', 'notes')}</Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isPending} sx={{ borderRadius: 2, px: 3 }}>
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Create Client'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search],
    queryFn: () => clientsService.list({ page: page + 1, size: pageSize, search: search || undefined }),
  });

  const { mutate: deleteClient } = useMutation({
    mutationFn: clientsService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      enqueueSnackbar('Client deleted', { variant: 'success' });
    },
  });

  const columns: GridColDef<Client>[] = [
    {
      field: 'full_name',
      headerName: 'Client',
      flex: 1.5,
      minWidth: 180,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
            {row.full_name.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{row.full_name}</Typography>
            <Typography variant="caption" color="text.secondary">{row.email}</Typography>
          </Box>
        </Box>
      ),
    },
    { field: 'phone', headerName: 'Phone', width: 140 },
    {
      field: 'risk_profile',
      headerName: 'Risk Profile',
      width: 130,
      renderCell: ({ value }) => (
        <Chip
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          size="small"
          color={RISK_COLORS[value] || 'default'}
          sx={{ height: 22, fontSize: 11, textTransform: 'capitalize' }}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: ({ value }) => (
        <Chip
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          size="small"
          color={STATUS_COLORS[value] || 'default'}
          variant="outlined"
          sx={{ height: 22, fontSize: 11 }}
        />
      ),
    },
    {
      field: 'kyc_verified',
      headerName: 'KYC',
      width: 80,
      renderCell: ({ value }) =>
        value ? (
          <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />
        ) : (
          <Cancel sx={{ color: 'error.main', fontSize: 18 }} />
        ),
    },
    {
      field: 'broker_accounts',
      headerName: 'Brokers',
      width: 80,
      renderCell: ({ value }) => (
        <Chip label={value?.length || 0} size="small" sx={{ height: 20, fontSize: 11 }} />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Added',
      width: 110,
      renderCell: ({ value }) => (
        <Typography variant="caption" color="text.secondary">
          {new Date(value).toLocaleDateString('en-IN')}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 110,
      sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => navigate(`/clients/${row.id}`)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => navigate(`/clients/${row.id}`)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                if (confirm(`Delete client ${row.full_name}?`)) deleteClient(row.id);
              }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Clients</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your client portfolio
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateOpen(true)}
          sx={{ borderRadius: 2, px: 2.5 }}
        >
          Add Client
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              placeholder="Search clients..."
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
              }}
              sx={{ width: 300, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Tooltip title="Filters">
              <IconButton><FilterList /></IconButton>
            </Tooltip>
          </Box>

          <DataGrid
            rows={data?.items || []}
            columns={columns}
            loading={isLoading}
            rowCount={data?.total || 0}
            paginationMode="server"
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={({ page: p }) => setPage(p)}
            pageSizeOptions={[20]}
            disableRowSelectionOnClick
            autoHeight
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell': { borderBottom: '1px solid #f5f5f5' },
              '& .MuiDataGrid-columnHeaders': { bgcolor: '#fafafa', borderRadius: 1 },
            }}
          />
        </CardContent>
      </Card>

      <CreateClientDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
}
