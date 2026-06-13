import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button,
  Avatar, Divider, Tab, Tabs, Table, TableBody, TableHead, TableRow,
  TableCell, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Switch, FormControlLabel,
  Alert, LinearProgress, Tooltip, CircularProgress,
} from '@mui/material';
import {
  ArrowBack, Edit, CheckCircle, Cancel, Add, Sync,
  Delete, Link as LinkIcon, LinkOff, History,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { clientsService } from '@/api/clients';
import { brokerService, BrokerCredential } from '@/api/broker';
import { portfolioService } from '@/api/portfolio';
import { ordersService } from '@/api/orders';
import { useState } from 'react';
import type { Holding } from '@/types';

const BROKER_COLORS: Record<string, string> = {
  zerodha: '#387ED1',
  upstox: '#5367FF',
  angelone: '#E30613',
};

const BROKER_LABELS: Record<string, string> = {
  zerodha: 'Zerodha',
  upstox: 'Upstox',
  angelone: 'AngelOne',
};

function BrokerIcon({ broker, size = 36 }: { broker: string; size?: number }) {
  return (
    <Box sx={{
      width: size, height: size, borderRadius: 1.5,
      bgcolor: `${BROKER_COLORS[broker]}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Typography variant="caption" fontWeight={800} sx={{ color: BROKER_COLORS[broker], fontSize: size * 0.28 }}>
        {broker.slice(0, 2).toUpperCase()}
      </Typography>
    </Box>
  );
}

function AddCredentialDialog({ clientId, open, onClose }: { clientId: string; open: boolean; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    broker: 'zerodha', account_id: '', display_name: '',
    api_key: '', api_secret: '', is_sandbox: true,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => brokerService.addCredential({ ...form, client_id: clientId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broker-credentials', clientId] });
      enqueueSnackbar('Broker account linked successfully', { variant: 'success' });
      onClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || 'Failed to add broker account', { variant: 'error' }),
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Link Broker Account</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField select fullWidth size="small" label="Broker" value={form.broker} onChange={e => set('broker', e.target.value)}>
              <MenuItem value="zerodha">Zerodha (KiteConnect)</MenuItem>
              <MenuItem value="upstox">Upstox V2</MenuItem>
              <MenuItem value="angelone">AngelOne (SmartAPI)</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Account / Client ID *" value={form.account_id}
              onChange={e => set('account_id', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Display Name" value={form.display_name}
              onChange={e => set('display_name', e.target.value)} placeholder={`${BROKER_LABELS[form.broker]} - ${form.account_id || 'ID'}`} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={form.is_sandbox} onChange={e => set('is_sandbox', e.target.checked)} color="warning" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Sandbox Mode {form.is_sandbox ? '(ON)' : '(OFF)'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {form.is_sandbox
                      ? 'Uses realistic mock data — no real credentials needed'
                      : 'Calls real broker API — API key required'}
                  </Typography>
                </Box>
              }
            />
          </Grid>
          {!form.is_sandbox && (
            <>
              <Grid item xs={12}>
                <Alert severity="info" sx={{ fontSize: 12 }}>
                  Live mode: enter your broker API credentials. Keys are AES-256 encrypted at rest.
                </Alert>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="API Key" value={form.api_key}
                  onChange={e => set('api_key', e.target.value)} type="password" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="API Secret" value={form.api_secret}
                  onChange={e => set('api_secret', e.target.value)} type="password" />
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button variant="contained" onClick={() => mutate()} disabled={!form.account_id || isPending}
          startIcon={isPending ? <CircularProgress size={16} /> : <LinkIcon />} sx={{ borderRadius: 2 }}>
          Link Account
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BrokerCard({ cred, clientId }: { cred: BrokerCredential; clientId: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await brokerService.testConnection(cred.id);
      const d = (res as any).data;
      if (d.success) enqueueSnackbar(`✓ ${d.message}`, { variant: 'success' });
      else enqueueSnackbar(`✗ ${d.message}`, { variant: 'error' });
    } catch { enqueueSnackbar('Connection test failed', { variant: 'error' }); }
    setTesting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await brokerService.triggerSync(clientId);
      const d = (res as any).data as any;
      enqueueSnackbar(
        `Sync complete — ${d.holdings_synced} holdings, ${d.prices_updated} prices updated`,
        { variant: 'success' }
      );
      qc.invalidateQueries({ queryKey: ['broker-credentials', clientId] });
    } catch { enqueueSnackbar('Sync failed', { variant: 'error' }); }
    setSyncing(false);
  };

  const { mutate: deleteCred } = useMutation({
    mutationFn: () => brokerService.deleteCredential(cred.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broker-credentials', clientId] });
      enqueueSnackbar('Broker account removed', { variant: 'info' });
    },
  });

  const lastSync = cred.last_sync_at
    ? new Date(cred.last_sync_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
    : 'Never';

  return (
    <Card variant="outlined" sx={{ mb: 1.5, borderColor: cred.is_active ? 'divider' : 'error.light' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <BrokerIcon broker={cred.broker} size={40} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" fontWeight={700}>{cred.display_name}</Typography>
              <Chip
                label={cred.is_sandbox ? 'Sandbox' : 'Live'}
                size="small"
                color={cred.is_sandbox ? 'warning' : 'success'}
                sx={{ height: 18, fontSize: 10 }}
              />
              {cred.last_sync_status && (
                <Chip
                  label={cred.last_sync_status}
                  size="small"
                  color={cred.last_sync_status === 'success' ? 'success' : 'error'}
                  variant="outlined"
                  sx={{ height: 18, fontSize: 10 }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              ID: {cred.account_id} · Last sync: {lastSync} · {cred.total_syncs} syncs
            </Typography>
            {syncing && <LinearProgress sx={{ mt: 0.5, borderRadius: 1 }} />}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Tooltip title="Test Connection">
              <IconButton size="small" onClick={handleTest} disabled={testing}>
                {testing ? <CircularProgress size={16} /> : <LinkIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={cred.is_sandbox ? 'Sandbox mode — live credentials required to import real holdings' : 'Sync Holdings from broker'}>
              <span>
                <IconButton size="small" onClick={handleSync} disabled={syncing || cred.is_sandbox} color="primary">
                  {syncing ? <CircularProgress size={16} /> : <Sync fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Remove">
              <IconButton size="small" color="error" onClick={() => deleteCred()}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function EditClientDetailDialog({
  open, onClose, client, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  client: import('@/types').Client;
  onSaved: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState({
    full_name: client.full_name,
    email: client.email,
    phone: client.phone,
    pan_number: client.pan_number || '',
    date_of_birth: client.date_of_birth || '',
    city: client.city || '',
    state: client.state || '',
    risk_profile: client.risk_profile,
    annual_income: client.annual_income?.toString() || '',
    investment_goal: client.investment_goal || '',
    investment_horizon_years: client.investment_horizon_years?.toString() || '',
    notes: client.notes || '',
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => clientsService.update(client.id, {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      pan_number: form.pan_number || undefined,
      date_of_birth: form.date_of_birth || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      risk_profile: form.risk_profile as any,
      annual_income: form.annual_income ? Number(form.annual_income) : undefined,
      investment_goal: form.investment_goal || undefined,
      investment_horizon_years: form.investment_horizon_years ? Number(form.investment_horizon_years) : undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      onSaved();
      enqueueSnackbar('Client updated successfully', { variant: 'success' });
      onClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || 'Update failed', { variant: 'error' }),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const tf = (label: string, key: keyof typeof form, type = 'text', half = true) => (
    <Grid item xs={12} sm={half ? 6 : 12}>
      <TextField fullWidth label={label} type={type} size="small" value={form[key]}
        onChange={set(key)}
        InputLabelProps={type === 'date' ? { shrink: true } : undefined}
        inputProps={type === 'date' ? { min: '1900-01-01', max: '2030-12-31' } : undefined}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
    </Grid>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper"
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <form onSubmit={(e) => { e.preventDefault(); mutate(); }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Client — {client.full_name}</DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            {tf('Full Name', 'full_name')}
            {tf('Email', 'email', 'email')}
            {tf('Phone', 'phone', 'tel')}
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="PAN Number" size="small"
                value={form.pan_number}
                onChange={(e) => setForm(f => ({ ...f, pan_number: e.target.value.toUpperCase() }))}
                placeholder="ABCDE1234F"
                helperText="Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)"
                inputProps={{ maxLength: 10, style: { letterSpacing: 2 } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            {tf('Date of Birth', 'date_of_birth', 'date')}
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Risk Profile" size="small" value={form.risk_profile}
                onChange={set('risk_profile')} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                <MenuItem value="conservative">Conservative</MenuItem>
                <MenuItem value="moderate">Moderate</MenuItem>
                <MenuItem value="aggressive">Aggressive</MenuItem>
              </TextField>
            </Grid>
            {tf('City', 'city')}
            {tf('State', 'state')}
            {tf('Annual Income (₹)', 'annual_income', 'number')}
            {tf('Investment Horizon (Years)', 'investment_horizon_years', 'number')}
            {tf('Investment Goal', 'investment_goal', 'text', false)}
            {tf('Notes', 'notes', 'text', false)}
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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { mutate: toggleKyc, isPending: kycPending } = useMutation({
    mutationFn: (verified: boolean) => clientsService.update(id!, { kyc_verified: verified } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      enqueueSnackbar('KYC status updated', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Failed to update KYC status', { variant: 'error' }),
  });

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsService.get(id!),
    enabled: !!id,
  });

  const { data: credentials = [] } = useQuery({
    queryKey: ['broker-credentials', id],
    queryFn: async () => {
      const res = await brokerService.listCredentials(id!);
      return (res as any).data as BrokerCredential[];
    },
    enabled: !!id,
  });

  if (isLoading) return <Box sx={{ p: 3 }}><Typography>Loading...</Typography></Box>;
  if (!client) return <Box sx={{ p: 3 }}><Typography>Client not found</Typography></Box>;

  const activeCredentials = credentials.filter(c => c.is_active);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/clients')}><ArrowBack /></IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={700}>{client.full_name}</Typography>
          <Typography variant="body2" color="text.secondary">{client.email}</Typography>
        </Box>
        <Button variant="outlined" startIcon={<Edit />} onClick={() => setEditOpen(true)} sx={{ borderRadius: 2 }}>Edit</Button>
      </Box>

      <Grid container spacing={2.5}>
        {/* Left column */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: '2rem', mx: 'auto', mb: 2 }}>
                {client.full_name.charAt(0)}
              </Avatar>
              <Typography variant="h6" fontWeight={700}>{client.full_name}</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>{client.email}</Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mt: 1 }}>
                <Chip label={client.status} size="small" color={client.status === 'active' ? 'success' : 'default'} />
                <Tooltip title={!client.pan_number ? 'PAN card details required to update KYC' : ''}>
                  <span>
                    <Chip
                      label={client.kyc_verified ? 'KYC Verified' : 'KYC Pending'}
                      size="small"
                      icon={client.kyc_verified ? <CheckCircle sx={{ fontSize: '14px !important' }} /> : <Cancel sx={{ fontSize: '14px !important' }} />}
                      color={client.kyc_verified ? 'success' : 'warning'}
                      variant="outlined"
                      onClick={client.pan_number ? () => toggleKyc(!client.kyc_verified) : undefined}
                      disabled={kycPending || !client.pan_number}
                      sx={{ cursor: client.pan_number ? 'pointer' : 'not-allowed' }}
                    />
                  </span>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>

          {/* Broker Accounts */}
          <Card sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Broker Accounts
                  {activeCredentials.length > 0 && (
                    <Chip label={activeCredentials.length} size="small" color="primary" sx={{ ml: 1, height: 18, fontSize: 10 }} />
                  )}
                </Typography>
                <Button size="small" startIcon={<Add />} onClick={() => setAddDialogOpen(true)}
                  variant="outlined" sx={{ borderRadius: 2, py: 0.3, fontSize: 12 }}>
                  Link
                </Button>
              </Box>
              {activeCredentials.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <LinkOff sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">No brokers linked</Typography>
                  <Button size="small" startIcon={<Add />} onClick={() => setAddDialogOpen(true)} sx={{ mt: 1 }}>
                    Link Broker
                  </Button>
                </Box>
              ) : (
                activeCredentials.map(cred => (
                  <BrokerCard key={cred.id} cred={cred} clientId={id!} />
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={8}>
          <Card>
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
                <Tab label="Profile" />
                <Tab label="Portfolio" />
                <Tab label="Sync Logs" />
                <Tab label="Orders" />
              </Tabs>
            </Box>
            <CardContent sx={{ p: 3 }}>
              {tab === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom color="primary">
                      Personal Information
                    </Typography>
                    <Table size="small">
                      <TableBody>
                        {[
                          ['Phone', client.phone],
                          ['PAN', client.pan_number || '—'],
                          ['Date of Birth', client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString('en-IN') : '—'],
                          ['City', client.city || '—'],
                          ['State', client.state || '—'],
                          ['Country', client.country],
                        ].map(([label, value]) => (
                          <TableRow key={label}>
                            <TableCell sx={{ border: 'none', pl: 0, py: 0.8, color: 'text.secondary', fontSize: 13, width: '45%' }}>{label}</TableCell>
                            <TableCell sx={{ border: 'none', py: 0.8, fontWeight: 500, fontSize: 13 }}>{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom color="primary">
                      Investment Profile
                    </Typography>
                    <Table size="small">
                      <TableBody>
                        {[
                          ['Risk Profile', client.risk_profile.charAt(0).toUpperCase() + client.risk_profile.slice(1)],
                          ['Annual Income', client.annual_income ? `₹${Number(client.annual_income).toLocaleString('en-IN')}` : '—'],
                          ['Horizon', client.investment_horizon_years ? `${client.investment_horizon_years} years` : '—'],
                          ['Goal', client.investment_goal || '—'],
                          ['Member Since', new Date(client.created_at).toLocaleDateString('en-IN')],
                        ].map(([label, value]) => (
                          <TableRow key={label}>
                            <TableCell sx={{ border: 'none', pl: 0, py: 0.8, color: 'text.secondary', fontSize: 13, width: '45%' }}>{label}</TableCell>
                            <TableCell sx={{ border: 'none', py: 0.8, fontWeight: 500, fontSize: 13 }}>{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Grid>
                  {client.notes && (
                    <Grid item xs={12}>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="subtitle2" fontWeight={700} gutterBottom color="primary">Notes</Typography>
                      <Typography variant="body2" color="text.secondary">{client.notes}</Typography>
                    </Grid>
                  )}
                </Grid>
              )}

              {tab === 1 && <ClientHoldingsTab clientId={id!} />}

              {tab === 2 && <SyncLogsTab clientId={id!} />}

              {tab === 3 && <ClientOrdersTab clientId={id!} />}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <AddCredentialDialog
        clientId={id!}
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
      />

      {client && (
        <EditClientDetailDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          client={client}
          onSaved={() => qc.invalidateQueries({ queryKey: ['client', id] })}
        />
      )}
    </Box>
  );
}

function ClientHoldingsTab({ clientId }: { clientId: string }) {
  const { data: holdings = [], isLoading } = useQuery({
    queryKey: ['holdings', clientId],
    queryFn: () => portfolioService.getHoldings(clientId),
    refetchInterval: 30_000,
  });

  if (isLoading) return <LinearProgress />;
  if (holdings.length === 0) return (
    <Alert severity="info" sx={{ mb: 1 }}>
      No holdings yet. To populate this portfolio, link a broker account with <strong>live credentials</strong> (disable sandbox mode) and trigger a Sync. Holdings are imported directly from the broker's API.
    </Alert>
  );

  const fmt = (v: number | string | null | undefined) => {
    if (v == null) return '—';
    const n = Number(v);
    if (isNaN(n)) return '—';
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const totalInvested = holdings.reduce((s, h) => s + Number(h.invested_value || 0), 0);
  const totalValue = holdings.reduce((s, h) => s + Number(h.current_value || 0), 0);
  const totalPnl = totalValue - totalInvested;

  return (
    <Box>
      {/* Summary strip */}
      <Box sx={{ display: 'flex', gap: 3, mb: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 2, flexWrap: 'wrap' }}>
        <Box><Typography variant="caption" color="text.secondary">Holdings</Typography><Typography fontWeight={700}>{holdings.length}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Invested</Typography><Typography fontWeight={700}>{fmt(totalInvested)}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">Current Value</Typography><Typography fontWeight={700}>{fmt(totalValue)}</Typography></Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Unrealized P&L</Typography>
          <Typography fontWeight={700} color={totalPnl >= 0 ? 'success.main' : 'error.main'}>
            {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              {['Symbol', 'Qty', 'Avg Price', 'Current Price', 'Invested', 'Value', 'P&L', 'Sector'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {holdings.map((h: Holding) => {
              const pnl = Number(h.unrealized_pnl || 0);
              return (
                <TableRow key={h.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{h.symbol}</Typography>
                    {h.name && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 100 }}>{h.name}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{Number(h.quantity).toLocaleString('en-IN')}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{fmt(h.average_buy_price)}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{h.current_price ? fmt(h.current_price) : '—'}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{fmt(h.invested_value)}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{fmt(h.current_value)}</TableCell>
                  <TableCell>
                    <Typography fontSize={13} fontWeight={600} color={pnl >= 0 ? 'success.main' : 'error.main'}>
                      {pnl >= 0 ? '+' : ''}{fmt(pnl)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {h.sector && <Chip label={h.sector} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

function ClientOrdersTab({ clientId }: { clientId: string }) {
  const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
    EXECUTED: 'success', PENDING: 'warning', OPEN: 'info',
    SUBMITTED: 'info', CANCELLED: 'error', REJECTED: 'error', FAILED: 'error',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['client-orders', clientId],
    queryFn: () => ordersService.list({ client_id: clientId, page: 1, size: 50 }).then(r => r.data),
    refetchInterval: 30_000,
  });

  const orders = data?.items || [];

  if (isLoading) return <LinearProgress />;
  if (orders.length === 0) return (
    <Alert severity="info">No orders placed for this client yet. Use the Orders page to place orders.</Alert>
  );

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: '#fafafa' }}>
            {['Symbol', 'Side', 'Type', 'Qty', 'Price', 'Broker', 'Status', 'Date'].map(h => (
              <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id} hover>
              <TableCell><Typography variant="body2" fontWeight={700}>{o.symbol}</Typography><Typography variant="caption" color="text.secondary">{o.exchange}</Typography></TableCell>
              <TableCell><Chip label={o.side} size="small" color={o.side === 'BUY' ? 'success' : 'error'} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} /></TableCell>
              <TableCell sx={{ fontSize: 12 }}>{o.price_type}</TableCell>
              <TableCell sx={{ fontSize: 13 }}>{o.quantity}</TableCell>
              <TableCell sx={{ fontSize: 13 }}>
                {o.average_price ? `₹${Number(o.average_price).toLocaleString('en-IN')}` : o.price ? `₹${Number(o.price).toLocaleString('en-IN')}` : 'MARKET'}
              </TableCell>
              <TableCell sx={{ fontSize: 12, textTransform: 'capitalize' }}>{o.broker}</TableCell>
              <TableCell><Chip label={o.status} size="small" color={STATUS_COLOR[o.status] || 'default'} variant="outlined" sx={{ height: 20, fontSize: 11 }} /></TableCell>
              <TableCell><Typography fontSize={11} color="text.secondary">{new Date(o.placed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</Typography></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function SyncLogsTab({ clientId }: { clientId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['sync-logs', clientId],
    queryFn: async () => {
      const res = await brokerService.getSyncLogs(clientId);
      return (res as any).data;
    },
  });

  if (isLoading) return <LinearProgress />;
  if (logs.length === 0) return (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <History sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
      <Typography color="text.secondary">No sync history yet. Trigger a sync from the broker accounts panel.</Typography>
    </Box>
  );

  return (
    <Table size="small">
      <TableBody>
        {logs.map((log: any) => (
          <TableRow key={log.id} hover>
            <TableCell sx={{ py: 1 }}>
              <BrokerIcon broker={log.broker} size={28} />
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{log.broker}</Typography>
              <Typography variant="caption" color="text.secondary">{log.sync_type}</Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <Chip label={log.status} size="small"
                color={log.status === 'success' ? 'success' : log.status === 'running' ? 'info' : 'error'}
                sx={{ height: 20, fontSize: 10 }} />
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <Typography variant="body2">{log.records_synced} records</Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {new Date(log.started_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </Typography>
            </TableCell>
            <TableCell sx={{ py: 1 }}>
              {log.duration_seconds != null && (
                <Typography variant="caption" color="text.secondary">{log.duration_seconds != null ? `${Number(log.duration_seconds).toFixed(1)}s` : '—'}</Typography>
              )}
            </TableCell>
            {log.error_message && (
              <TableCell sx={{ py: 1, color: 'error.main', fontSize: 11 }}>{log.error_message}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
