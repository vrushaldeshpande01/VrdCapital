import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Grid,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider,
  LinearProgress, TextField, MenuItem,
} from '@mui/material';
import {
  PictureAsPdf, TableChart, Assessment, Download, Schedule,
  CheckCircle, HourglassEmpty,
} from '@mui/icons-material';

const REPORT_TYPES = [
  { id: 'portfolio_summary', label: 'Portfolio Summary', icon: <Assessment />, desc: 'Complete holdings, P&L and allocation breakdown' },
  { id: 'client_statement', label: 'Client Statement', icon: <TableChart />, desc: 'Detailed transaction and position statement' },
  { id: 'tax_report', label: 'Tax P&L Report', icon: <PictureAsPdf />, desc: 'Realized gains/losses for tax filing (STCG/LTCG)' },
  { id: 'performance', label: 'Performance Report', icon: <Assessment />, desc: 'Returns vs benchmark, Sharpe ratio, drawdown' },
];

const RECENT_REPORTS = [
  { id: '1', name: 'Portfolio Summary — June 2026', type: 'PDF', size: '1.2 MB', status: 'READY', created: '2026-06-10' },
  { id: '2', name: 'Client Statement Q1 2026', type: 'XLSX', size: '3.4 MB', status: 'READY', created: '2026-06-08' },
  { id: '3', name: 'Tax P&L FY 2025-26', type: 'PDF', size: '0.8 MB', status: 'GENERATING', created: '2026-06-11' },
  { id: '4', name: 'Performance Report May 2026', type: 'PDF', size: '2.1 MB', status: 'READY', created: '2026-06-03' },
];

export default function ReportsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [format, setFormat] = useState('PDF');
  const [period, setPeriod] = useState('this_month');

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Reports</Typography>
        <Typography variant="body2" color="text.secondary">Generate and download portfolio reports</Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Generate Report</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Select a report type to get started</Typography>

              <List disablePadding>
                {REPORT_TYPES.map((r, i) => (
                  <Box key={r.id}>
                    <ListItemButton
                      selected={selected === r.id}
                      onClick={() => setSelected(r.id)}
                      sx={{ borderRadius: 2, mb: 0.5, '&.Mui-selected': { bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.main' } }}
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
                      <TextField select fullWidth size="small" label="Period" value={period} onChange={e => setPeriod(e.target.value)}>
                        <MenuItem value="this_month">This Month</MenuItem>
                        <MenuItem value="last_month">Last Month</MenuItem>
                        <MenuItem value="this_quarter">This Quarter</MenuItem>
                        <MenuItem value="this_fy">This FY</MenuItem>
                        <MenuItem value="last_fy">Last FY</MenuItem>
                        <MenuItem value="custom">Custom Range</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField select fullWidth size="small" label="Format" value={format} onChange={e => setFormat(e.target.value)}>
                        <MenuItem value="PDF">PDF</MenuItem>
                        <MenuItem value="XLSX">Excel</MenuItem>
                        <MenuItem value="CSV">CSV</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>
                  <Button fullWidth variant="contained" startIcon={<Download />} sx={{ borderRadius: 2 }}>
                    Generate Report
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Recent Reports</Typography>
              <List disablePadding>
                {RECENT_REPORTS.map((r, i) => (
                  <Box key={r.id}>
                    <ListItem
                      sx={{ px: 0 }}
                      secondaryAction={
                        r.status === 'READY'
                          ? <Button size="small" startIcon={<Download />} variant="outlined" sx={{ borderRadius: 2, fontSize: 12 }}>Download</Button>
                          : <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <HourglassEmpty fontSize="small" color="warning" />
                              <Typography variant="caption" color="warning.main">Generating...</Typography>
                            </Box>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {r.status === 'READY' ? <CheckCircle color="success" fontSize="small" /> : <Schedule color="warning" fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600} sx={{ pr: 14 }}>{r.name}</Typography>}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {r.type} · {r.size} · {r.created}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {r.status === 'GENERATING' && <LinearProgress sx={{ mx: 0, mb: 1, borderRadius: 1 }} />}
                    {i < RECENT_REPORTS.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
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
                Scheduling will be available in Phase 5 (Report Service).
              </Typography>
              <Button variant="outlined" size="small" sx={{ mt: 2, borderRadius: 2 }} disabled>
                Configure Schedule
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
