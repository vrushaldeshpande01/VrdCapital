import { useState, useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider,
  LinearProgress, TextField, MenuItem, CircularProgress, Alert, Chip,
  IconButton, Tooltip,
} from '@mui/material';
import {
  PictureAsPdf, TableChart, Assessment, Download, Schedule,
  CheckCircle, HourglassEmpty, ErrorOutline, Refresh, Delete,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  reportsService, Report, ReportType, ReportFormat, ReportPeriod,
} from '@/api/reports';

const REPORT_TYPES: { id: ReportType; label: string; icon: JSX.Element; desc: string }[] = [
  { id: 'portfolio_summary', label: 'Portfolio Summary',  icon: <Assessment />, desc: 'Holdings, P&L and allocation breakdown' },
  { id: 'client_statement',  label: 'Client Statement',   icon: <TableChart />, desc: 'Position & transaction statement per client' },
  { id: 'order_history',     label: 'Order History',      icon: <TableChart />, desc: 'All orders with status, price and broker' },
  { id: 'performance',       label: 'Performance Report', icon: <Assessment />, desc: 'Returns, value history and trend analysis' },
  { id: 'tax_report',        label: 'Tax P&L Report',     icon: <PictureAsPdf />, desc: 'Realized gains/losses for tax filing (STCG/LTCG)' },
];

const STATUS_ICON: Record<string, JSX.Element> = {
  READY:      <CheckCircle color="success" fontSize="small" />,
  GENERATING: <HourglassEmpty color="warning" fontSize="small" />,
  PENDING:    <HourglassEmpty color="action" fontSize="small" />,
  FAILED:     <ErrorOutline color="error" fontSize="small" />,
};

const FORMAT_COLOR: Record<string, string> = {
  PDF: '#c62828', XLSX: '#2e7d32', CSV: '#1565c0',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ReportsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<ReportType | null>(null);
  const [format, setFormat] = useState<ReportFormat>('PDF');
  const [period, setPeriod] = useState<ReportPeriod>('this_month');
  const [downloading, setDownloading] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsService.list().then(r => r.data),
    refetchInterval: 5000,   // poll every 5s while any report is generating
    refetchIntervalInBackground: false,
  });

  // Stop polling when nothing is in progress
  const hasInProgress = reports.some(r => r.status === 'PENDING' || r.status === 'GENERATING');

  const { mutate: generate, isPending: isGenerating } = useMutation({
    mutationFn: () => reportsService.generate({
      report_type: selected!,
      format,
      period,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      enqueueSnackbar(`"${res.data.name}" is being generated…`, { variant: 'info' });
    },
    onError: (e: any) => enqueueSnackbar(
      e?.response?.data?.detail || 'Failed to start report generation', { variant: 'error' }
    ),
  });

  const handleDownload = async (report: Report) => {
    setDownloading(report.id);
    try {
      await reportsService.download(report.id, report.name, report.format);
      enqueueSnackbar(`"${report.name}" downloaded`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Download failed — report may still be generating', { variant: 'error' });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Reports</Typography>
          <Typography variant="body2" color="text.secondary">Generate PDF and Excel reports from live portfolio data</Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()}><Refresh /></IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={3}>
        {/* Left: Generate panel */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Generate Report</Typography>

              <List disablePadding>
                {REPORT_TYPES.map((r, i) => (
                  <Box key={r.id}>
                    <ListItemButton
                      selected={selected === r.id}
                      onClick={() => setSelected(r.id)}
                      sx={{
                        borderRadius: 2, mb: 0.5,
                        '&.Mui-selected': {
                          bgcolor: 'primary.50',
                          border: '1px solid',
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, color: selected === r.id ? 'primary.main' : 'text.secondary' }}>
                        {r.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{r.label}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{r.desc}</Typography>}
                      />
                    </ListItemButton>
                    {i < REPORT_TYPES.length - 1 && <Divider sx={{ my: 0.5 }} />}
                  </Box>
                ))}
              </List>

              {selected && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <TextField select fullWidth size="small" label="Period"
                        value={period} onChange={e => setPeriod(e.target.value as ReportPeriod)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                        <MenuItem value="this_month">This Month</MenuItem>
                        <MenuItem value="last_month">Last Month</MenuItem>
                        <MenuItem value="this_quarter">This Quarter</MenuItem>
                        <MenuItem value="this_fy">This FY (2025-26)</MenuItem>
                        <MenuItem value="last_fy">Last FY (2024-25)</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField select fullWidth size="small" label="Format"
                        value={format} onChange={e => setFormat(e.target.value as ReportFormat)}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                        <MenuItem value="PDF">PDF</MenuItem>
                        <MenuItem value="XLSX">Excel (.xlsx)</MenuItem>
                        <MenuItem value="CSV">CSV</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>
                  <Button
                    fullWidth variant="contained"
                    startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : <Download />}
                    onClick={() => generate()}
                    disabled={isGenerating}
                    sx={{ borderRadius: 2 }}
                  >
                    {isGenerating ? 'Queuing…' : 'Generate Report'}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Schedule fontSize="small" color="action" />
                <Typography variant="h6" fontWeight={600}>Scheduled Reports</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Automatically generate and email reports on a schedule.
              </Typography>
              <Button variant="outlined" size="small" sx={{ mt: 2, borderRadius: 2 }} disabled>
                Coming in Phase 7
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Recent reports */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Recent Reports
                {hasInProgress && (
                  <Chip label="Generating…" size="small" color="warning" sx={{ ml: 1, height: 20, fontSize: 11 }} />
                )}
              </Typography>

              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : reports.length === 0 ? (
                <Alert severity="info">
                  No reports yet. Select a report type on the left and click <strong>Generate Report</strong>.
                </Alert>
              ) : (
                <List disablePadding>
                  {reports.map((r, i) => (
                    <Box key={r.id}>
                      <ListItem
                        sx={{ px: 0, alignItems: 'flex-start' }}
                        secondaryAction={
                          r.status === 'READY' ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={downloading === r.id ? <CircularProgress size={14} /> : <Download />}
                              onClick={() => handleDownload(r)}
                              disabled={downloading === r.id}
                              sx={{ borderRadius: 2, fontSize: 12, minWidth: 110 }}
                            >
                              {downloading === r.id ? 'Saving…' : 'Download'}
                            </Button>
                          ) : r.status === 'FAILED' ? (
                            <Chip label="Failed" color="error" size="small" variant="outlined" />
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={14} />
                              <Typography variant="caption" color="text.secondary">
                                {r.status === 'PENDING' ? 'Queued' : 'Generating…'}
                              </Typography>
                            </Box>
                          )
                        }
                      >
                        <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                          {STATUS_ICON[r.status]}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={600} sx={{ pr: 16 }}>
                              {r.name}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
                              <Chip
                                label={r.format}
                                size="small"
                                sx={{
                                  height: 18, fontSize: 10, fontWeight: 700,
                                  color: FORMAT_COLOR[r.format],
                                  borderColor: FORMAT_COLOR[r.format],
                                }}
                                variant="outlined"
                              />
                              {r.size !== '—' && (
                                <Typography variant="caption" color="text.secondary">{r.size}</Typography>
                              )}
                              <Typography variant="caption" color="text.disabled">
                                {timeAgo(r.created_at)}
                              </Typography>
                              {r.error_message && (
                                <Typography variant="caption" color="error" noWrap sx={{ maxWidth: 200 }}>
                                  {r.error_message}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {(r.status === 'GENERATING' || r.status === 'PENDING') && (
                        <LinearProgress sx={{ mx: 0, mb: 1, borderRadius: 1 }} />
                      )}
                      {i < reports.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
