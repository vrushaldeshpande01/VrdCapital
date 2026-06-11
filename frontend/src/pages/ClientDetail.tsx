import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button,
  Avatar, Divider, Tab, Tabs, Table, TableBody, TableRow,
  TableCell, IconButton,
} from '@mui/material';
import { ArrowBack, Edit, CheckCircle, Cancel } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { clientsService } from '@/api/clients';
import { useState } from 'react';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsService.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <Box sx={{ p: 3 }}><Typography>Loading...</Typography></Box>;
  if (!client) return <Box sx={{ p: 3 }}><Typography>Client not found</Typography></Box>;

  const BROKER_COLORS: Record<string, string> = {
    zerodha: '#387ED1',
    upstox: '#5367FF',
    angelone: '#E30613',
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/clients')}><ArrowBack /></IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={700}>{client.full_name}</Typography>
          <Typography variant="body2" color="text.secondary">{client.email}</Typography>
        </Box>
        <Button variant="outlined" startIcon={<Edit />} sx={{ borderRadius: 2 }}>Edit</Button>
      </Box>

      <Grid container spacing={2.5}>
        {/* Profile card */}
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
                <Chip
                  label={client.kyc_verified ? 'KYC Verified' : 'KYC Pending'}
                  size="small"
                  icon={client.kyc_verified ? <CheckCircle sx={{ fontSize: '14px !important' }} /> : <Cancel sx={{ fontSize: '14px !important' }} />}
                  color={client.kyc_verified ? 'success' : 'warning'}
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>

          {/* Broker Accounts */}
          <Card sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Broker Accounts
              </Typography>
              {client.broker_accounts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No broker accounts linked</Typography>
              ) : (
                client.broker_accounts.map((acc) => (
                  <Box key={acc.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid #f5f5f5' }}>
                    <Box
                      sx={{
                        width: 32, height: 32, borderRadius: 1,
                        bgcolor: `${BROKER_COLORS[acc.broker]}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} sx={{ color: BROKER_COLORS[acc.broker], fontSize: '0.65rem' }}>
                        {acc.broker.slice(0, 2).toUpperCase()}
                      </Typography>
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{acc.broker.charAt(0).toUpperCase() + acc.broker.slice(1)}</Typography>
                      <Typography variant="caption" color="text.secondary">{acc.account_id}</Typography>
                    </Box>
                    <Chip label={acc.status} size="small" color={acc.status === 'active' ? 'success' : 'default'} sx={{ height: 18, fontSize: 10 }} />
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Details */}
        <Grid item xs={12} md={8}>
          <Card>
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
                <Tab label="Profile" />
                <Tab label="Portfolio" />
                <Tab label="Orders" />
                <Tab label="Reports" />
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
              {tab === 1 && (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography color="text.secondary">Portfolio data will be available in Phase 2</Typography>
                </Box>
              )}
              {tab === 2 && (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography color="text.secondary">Order history will be available in Phase 4</Typography>
                </Box>
              )}
              {tab === 3 && (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography color="text.secondary">Reports will be available in Phase 5</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
