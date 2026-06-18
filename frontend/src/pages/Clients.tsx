import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, TextField,
  InputAdornment, Chip, IconButton, Tooltip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, MenuItem, CircularProgress, Alert,
} from '@mui/material';
import {
  Search, Add, Visibility,
  CheckCircle, Cancel, FilterList,
  DeleteOutline, UploadFile, Download, CheckCircleOutline, ErrorOutline,
} from '@mui/icons-material';
import { List, ListItem, ListItemIcon, ListItemText, LinearProgress } from '@mui/material';
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

function EditClientDialog({ open, onClose, client }: { open: boolean; onClose: () => void; client: Client | null }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<Partial<CreateClientPayload>>(() => client ? {
    full_name: client.full_name,
    email: client.email,
    phone: client.phone,
    pan_number: client.pan_number || '',
    risk_profile: client.risk_profile,
    annual_income: client.annual_income ?? undefined,
    investment_goal: client.investment_goal || '',
    investment_horizon_years: client.investment_horizon_years ?? undefined,
    notes: client.notes || '',
  } : {});

  const { mutate, isPending, error } = useMutation({
    mutationFn: (payload: Partial<CreateClientPayload>) => clientsService.update(client!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      enqueueSnackbar('Client updated successfully', { variant: 'success' });
      onClose();
    },
  });

  if (!client) return null;

  const field = (label: string, key: keyof CreateClientPayload, type = 'text') => (
    <TextField
      fullWidth label={label} type={type} size="small"
      value={form[key] || ''}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <form onSubmit={(e) => { e.preventDefault(); mutate(form); }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Client — {client.full_name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{(error as any)?.response?.data?.detail || 'Update failed'}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>{field('Full Name', 'full_name')}</Grid>
            <Grid item xs={12} sm={6}>{field('Email', 'email', 'email')}</Grid>
            <Grid item xs={12} sm={6}>{field('Phone', 'phone', 'tel')}</Grid>
            <Grid item xs={12} sm={6}>{field('PAN Number', 'pan_number')}</Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Risk Profile" size="small"
                value={form.risk_profile || 'moderate'}
                onChange={(e) => setForm((f) => ({ ...f, risk_profile: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
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
            {isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

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

function DeleteClientDialog({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { mutate, isPending } = useMutation({
    mutationFn: () => clientsService.delete(client!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-stats'] });
      enqueueSnackbar('Client deleted successfully', { variant: 'success' });
      onClose();
    },
    onError: (err: any) => {
      enqueueSnackbar(err?.response?.data?.detail ?? 'Delete failed', { variant: 'error' });
    },
  });

  if (!client) return null;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Delete Client</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Are you sure you want to delete <strong>{client.full_name}</strong>? This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          disabled={isPending}
          onClick={() => mutate()}
          sx={{ borderRadius: 2, px: 3 }}
        >
          {isPending ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CsvImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () => clientsService.bulkImport(file!),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      enqueueSnackbar(`Imported ${data.created} client${data.created !== 1 ? 's' : ''}`, { variant: 'success' });
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail ?? 'Import failed', { variant: 'error' }),
  });

  const handleClose = () => { setFile(null); setResult(null); onClose(); };

  const downloadTemplate = () => {
    const csv = 'full_name,email,phone,pan_number,risk_profile,annual_income,investment_goal,investment_horizon_years,city,state\nJohn Doe,john@example.com,9876543210,ABCDE1234F,moderate,1000000,Wealth creation,10,Mumbai,Maharashtra\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'client_import_template.csv';
    a.click();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Import Clients from CSV</DialogTitle>
      <DialogContent>
        {!result ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Alert severity="info" action={
              <Button size="small" startIcon={<Download />} onClick={downloadTemplate}>Template</Button>
            }>
              Download the template to see required columns (full_name, email are mandatory).
            </Alert>
            <Box
              component="label"
              htmlFor="csv-upload"
              sx={{
                border: '2px dashed', borderColor: file ? 'success.main' : 'divider',
                borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
                bgcolor: file ? 'success.50' : 'background.default',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
                transition: 'all 0.15s',
              }}
            >
              <input id="csv-upload" type="file" accept=".csv" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} />
              <UploadFile sx={{ fontSize: 36, color: file ? 'success.main' : 'text.secondary', mb: 1 }} />
              <Typography variant="body2" fontWeight={600}>
                {file ? file.name : 'Click to select CSV file'}
              </Typography>
              {file && <Typography variant="caption" color="text.secondary">{(file.size / 1024).toFixed(1)} KB</Typography>}
            </Box>
            {isPending && <LinearProgress />}
          </Box>
        ) : (
          <Box sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              {[['Created', result.created, 'success.main'], ['Skipped', result.skipped, 'warning.main'], ['Errors', result.errors, 'error.main']].map(([l, v, c]) => (
                <Box key={l as string} sx={{ textAlign: 'center', flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'background.default' }}>
                  <Typography variant="h5" fontWeight={700} color={c as string}>{v as number}</Typography>
                  <Typography variant="caption" color="text.secondary">{l as string}</Typography>
                </Box>
              ))}
            </Box>
            {result.rows_errored.length > 0 && (
              <Alert severity="error" sx={{ mb: 1 }}>
                <Typography variant="caption" fontWeight={600}>Errors:</Typography>
                {result.rows_errored.slice(0, 5).map((r: any) => (
                  <Typography key={r.row} variant="caption" display="block">Row {r.row}: {r.reason}</Typography>
                ))}
              </Alert>
            )}
            {result.rows_skipped.length > 0 && (
              <Alert severity="warning">
                <Typography variant="caption" fontWeight={600}>Skipped (duplicates):</Typography>
                {result.rows_skipped.slice(0, 5).map((r: any) => (
                  <Typography key={r.row} variant="caption" display="block">Row {r.row}: {r.email} — {r.reason}</Typography>
                ))}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} sx={{ borderRadius: 2 }}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button
            variant="contained" onClick={() => mutate()}
            disabled={!file || isPending}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : <UploadFile />}
            sx={{ borderRadius: 2 }}
          >
            {isPending ? 'Importing…' : 'Import'}
          </Button>
        )}
      </DialogActions>
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
  const [importOpen, setImportOpen] = useState(false);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search],
    queryFn: () => clientsService.list({ page: page + 1, size: pageSize, search: search || undefined }),
  });

  const columns: GridColDef<Client>[] = [
    {
      field: 'full_name',
      headerName: 'Client',
      flex: 1.5,
      minWidth: 180,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', height: '100%' }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.85rem', flexShrink: 0 }}>
            {row.full_name.charAt(0)}
          </Avatar>
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>{row.full_name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{row.email}</Typography>
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
      align: 'center',
      headerAlign: 'center',
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, width: '100%', height: '100%' }}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => navigate(`/clients/${row.id}`)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete client">
            <IconButton size="small" color="error" onClick={() => setDeleteClient(row)}>
              <DeleteOutline fontSize="small" />
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<UploadFile />}
            onClick={() => setImportOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Import CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateOpen(true)}
            sx={{ borderRadius: 2, px: 2.5 }}
          >
            Add Client
          </Button>
        </Box>
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
            rowHeight={64}
            disableRowSelectionOnClick
            autoHeight
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell': { borderBottom: '1px solid #f5f5f5', alignItems: 'center' },
              '& .MuiDataGrid-columnHeaders': { bgcolor: '#fafafa', borderRadius: 1 },
              '& .MuiDataGrid-row': { alignItems: 'center' },
            }}
          />
        </CardContent>
      </Card>

      <CreateClientDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <CsvImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <DeleteClientDialog client={deleteClient} onClose={() => setDeleteClient(null)} />
    </Box>
  );
}
