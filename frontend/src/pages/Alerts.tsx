import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Grid, Alert, CircularProgress, Tooltip, Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add, NotificationsActive, Delete, TrendingUp, TrendingDown,
  ShowChart, Refresh, PauseCircle, PlayCircle,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { notificationService, Alert as AlertType, AlertCondition, CreateAlertPayload } from '@/api/notifications';

const CONDITION_LABELS: Record<AlertCondition, { label: string; icon: React.ReactNode; color: string }> = {
  price_above:   { label: 'Price Above',    icon: <TrendingUp />,   color: '#2e7d32' },
  price_below:   { label: 'Price Below',    icon: <TrendingDown />, color: '#c62828' },
  change_pct_up: { label: '% Gain >',       icon: <TrendingUp />,   color: '#1565c0' },
  change_pct_dn: { label: '% Loss >',       icon: <TrendingDown />, color: '#e65100' },
  pnl_above:     { label: 'Portfolio P&L >', icon: <ShowChart />,   color: '#2e7d32' },
  pnl_below:     { label: 'Portfolio P&L <', icon: <ShowChart />,  color: '#c62828' },
};

function CreateAlertDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<Partial<CreateAlertPayload>>({
    condition: 'price_above',
    threshold: 0,
    repeat_count: 1,
  });
  const [usePortfolio, setUsePortfolio] = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => notificationService.createAlert(form as CreateAlertPayload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      enqueueSnackbar('Alert created', { variant: 'success' });
      onClose();
    },
  });

  const f = (key: keyof CreateAlertPayload) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  const isPortfolioCondition = form.condition === 'pnl_above' || form.condition === 'pnl_below';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsActive color="primary" />
          Create Alert
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{(error as any)?.response?.data?.detail ?? 'Failed'}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            select fullWidth size="small" label="Condition"
            value={form.condition}
            onChange={e => setForm(p => ({ ...p, condition: e.target.value as AlertCondition }))}
          >
            {Object.entries(CONDITION_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: v.color, display: 'flex', alignItems: 'center' }}>{v.icon}</Box>
                  {v.label}
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {!isPortfolioCondition && (
            <TextField
              fullWidth size="small" label="Symbol (e.g. INFY)"
              value={form.symbol ?? ''}
              onChange={e => setForm(p => ({ ...p, symbol: e.target.value.toUpperCase() }))}
              placeholder="INFY, RELIANCE, TCS…"
            />
          )}

          <TextField
            fullWidth size="small" label={
              form.condition?.includes('pct') ? 'Threshold (%)' :
              form.condition?.includes('pnl') ? 'Threshold (₹)' : 'Threshold Price (₹)'
            }
            type="number"
            value={form.threshold ?? ''}
            onChange={f('threshold')}
            inputProps={{ min: 0.01, step: 0.01 }}
          />

          <TextField
            fullWidth size="small" label="Label (optional)"
            value={form.label ?? ''}
            onChange={f('label')}
            placeholder="e.g. Take profit signal"
          />

          <TextField
            select fullWidth size="small" label="Fire"
            value={form.repeat_count ?? 1}
            onChange={e => setForm(p => ({ ...p, repeat_count: Number(e.target.value) || null }))}
          >
            <MenuItem value={1}>Once</MenuItem>
            <MenuItem value={3}>Up to 3 times</MenuItem>
            <MenuItem value={0}>Every time</MenuItem>
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained" onClick={() => mutate()}
          disabled={isPending || !form.condition || !form.threshold}
          sx={{ borderRadius: 2 }}
        >
          {isPending ? <CircularProgress size={16} color="inherit" /> : 'Create Alert'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AlertCard({ alert }: { alert: AlertType }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const cond = CONDITION_LABELS[alert.condition as AlertCondition];

  const { mutate: del } = useMutation({
    mutationFn: () => notificationService.deleteAlert(alert.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); enqueueSnackbar('Alert deleted', { variant: 'info' }); },
  });

  const { mutate: toggle } = useMutation({
    mutationFn: () => notificationService.updateAlert(alert.id, {
      status: alert.status === 'active' ? 'paused' : 'active',
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const statusColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    active: 'success', paused: 'warning', triggered: 'default', deleted: 'error',
  };

  return (
    <Card sx={{ position: 'relative' }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ color: cond?.color ?? 'text.secondary' }}>{cond?.icon}</Box>
            <Typography variant="body2" fontWeight={700}>
              {alert.symbol ?? 'Portfolio'}
            </Typography>
          </Box>
          <Chip label={alert.status} size="small" color={statusColor[alert.status] ?? 'default'} sx={{ height: 20, fontSize: 10 }} />
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {cond?.label ?? alert.condition} — <strong>
            {alert.condition.includes('pct') ? `${alert.threshold}%` : `₹${Number(alert.threshold).toLocaleString('en-IN')}`}
          </strong>
        </Typography>

        {alert.label && (
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            {alert.label}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Typography variant="caption" color="text.disabled">
            Fired {alert.fired_count} / {alert.repeat_count ?? '∞'} times
            {alert.triggered_at && ` · last ${new Date(alert.triggered_at).toLocaleDateString('en-IN')}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={alert.status === 'active' ? 'Pause' : 'Resume'}>
              <IconButton size="small" onClick={() => toggle()}>
                {alert.status === 'active' ? <PauseCircle fontSize="small" /> : <PlayCircle fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => del()}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('active');

  const { data: alerts = [], isLoading, refetch } = useQuery<AlertType[]>({
    queryKey: ['alerts', filterStatus],
    queryFn: () => notificationService.listAlerts(filterStatus || undefined).then(r => r.data),
    refetchInterval: 60_000,
  });

  const { mutate: evaluate, isPending: evaluating } = useMutation({
    mutationFn: () => notificationService.evaluateAlerts(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      const { evaluated, triggered } = (data as any).data;
      enqueueSnackbar(`Checked ${evaluated} alert(s) — ${triggered} triggered`, {
        variant: triggered > 0 ? 'warning' : 'success',
      });
    },
  });

  const byStatus = {
    active:    alerts.filter(a => a.status === 'active'),
    paused:    alerts.filter(a => a.status === 'paused'),
    triggered: alerts.filter(a => a.status === 'triggered'),
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Smart Alerts</Typography>
          <Typography variant="body2" color="text.secondary">
            Get notified when prices hit your targets
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={evaluating ? <CircularProgress size={16} /> : <Refresh />}
            onClick={() => evaluate()}
            disabled={evaluating}
          >
            Check Now
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            New Alert
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          ['Active', byStatus.active.length, 'success.main'],
          ['Paused', byStatus.paused.length, 'warning.main'],
          ['Triggered', byStatus.triggered.length, 'text.secondary'],
        ].map(([label, count, color]) => (
          <Grid item xs={4} key={label as string}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: '12px !important' }}>
                <Typography variant="h4" fontWeight={700} color={color as string}>{count as number}</Typography>
                <Typography variant="caption" color="text.secondary">{label as string}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filter */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {['active', 'paused', 'triggered', ''].map((s) => (
          <Chip
            key={s || 'all'}
            label={s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            onClick={() => setFilterStatus(s)}
            color={filterStatus === s ? 'primary' : 'default'}
            variant={filterStatus === s ? 'filled' : 'outlined'}
            size="small"
          />
        ))}
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : alerts.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No alerts {filterStatus ? `with status "${filterStatus}"` : ''}. Click <strong>New Alert</strong> to create one.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {alerts.map(a => (
            <Grid item xs={12} sm={6} md={4} key={a.id}>
              <AlertCard alert={a} />
            </Grid>
          ))}
        </Grid>
      )}

      <CreateAlertDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
}
