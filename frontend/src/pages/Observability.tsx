import React from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Tooltip,
  CircularProgress, Alert, Button, IconButton,
} from '@mui/material';
import {
  CheckCircle, Error, Warning, Refresh, OpenInNew,
  Memory, Speed, Timeline, BarChart,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api/client';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unreachable';
  latency_ms: number | null;
  details: Record<string, unknown>;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  services: ServiceHealth[];
  summary: { healthy: number; degraded: number; unreachable: number };
}

const STATUS_ICON: Record<string, React.ReactElement> = {
  healthy:     <CheckCircle color="success" />,
  degraded:    <Warning color="warning" />,
  unreachable: <Error color="error" />,
  down:        <Error color="error" />,
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  healthy: 'success', degraded: 'warning', unreachable: 'error',
};

const OVERALL_BG: Record<string, string> = {
  healthy: '#e8f5e9', degraded: '#fff3e0', down: '#ffebee',
};

const SERVICE_PORTS: Record<string, number> = {
  'auth-service': 8001, 'client-service': 8002, 'portfolio-service': 8003,
  'broker-service': 8004, 'order-service': 8005, 'notification-service': 8006,
  'report-service': 8007,
};

export default function ObservabilityPage() {
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: () => authApi.get<SystemHealth>('/api/v1/system/health').then(r => r.data),
    refetchInterval: 30_000,
    retry: 1,
  });

  const lastChecked = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN')
    : '—';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Observability</Typography>
          <Typography variant="body2" color="text.secondary">
            Live service health, metrics and monitoring
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.disabled">Last checked: {lastChecked}</Typography>
          <Tooltip title="Refresh now">
            <IconButton onClick={() => refetch()} size="small" disabled={isFetching}>
              {isFetching ? <CircularProgress size={18} /> : <Refresh />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Overall status banner */}
      {data && (
        <Card sx={{ mb: 3, bgcolor: OVERALL_BG[data.overall] || '#f5f5f5', border: '1px solid', borderColor: data.overall === 'healthy' ? 'success.light' : data.overall === 'degraded' ? 'warning.light' : 'error.light' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {STATUS_ICON[data.overall]}
              <Box>
                <Typography fontWeight={700} fontSize={15}>
                  Platform {data.overall === 'healthy' ? 'is Healthy' : data.overall === 'degraded' ? 'is Degraded' : 'is Down'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {data.summary.healthy} healthy · {data.summary.degraded} degraded · {data.summary.unreachable} unreachable
                </Typography>
              </Box>
            </Box>
            <Chip
              label={`${data.summary.healthy}/${data.services.length} up`}
              color={STATUS_COLOR[data.overall]}
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          </CardContent>
        </Card>
      )}

      {isLoading && !data && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && !data && (
        <Alert severity="error">
          Could not reach the health endpoint. Make sure all services are running.
        </Alert>
      )}

      {/* Service cards */}
      {data && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {data.services.map(svc => (
            <Grid item xs={12} sm={6} md={4} key={svc.name}>
              <Card variant="outlined" sx={{ borderRadius: 2, borderColor: svc.status === 'healthy' ? 'success.light' : svc.status === 'degraded' ? 'warning.light' : 'error.light' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {STATUS_ICON[svc.status]}
                      <Box>
                        <Typography fontWeight={700} fontSize={13}>{svc.name}</Typography>
                        <Chip
                          label={svc.status}
                          size="small"
                          color={STATUS_COLOR[svc.status]}
                          sx={{ height: 18, fontSize: 10, mt: 0.25 }}
                        />
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      {svc.latency_ms != null && (
                        <Typography fontSize={12} color="text.secondary">
                          <Speed sx={{ fontSize: 12, mr: 0.25, verticalAlign: 'middle' }} />
                          {svc.latency_ms} ms
                        </Typography>
                      )}
                      {SERVICE_PORTS[svc.name] && (
                        <Tooltip title={`Open :${SERVICE_PORTS[svc.name]}/docs`}>
                          <IconButton
                            size="small"
                            component="a"
                            href={`http://localhost:${SERVICE_PORTS[svc.name]}/docs`}
                            target="_blank"
                            sx={{ p: 0.25 }}
                          >
                            <OpenInNew sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  {/* Extra details from health response */}
                  {svc.details && Object.keys(svc.details).filter(k => k !== 'status' && k !== 'service').length > 0 && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                      {Object.entries(svc.details)
                        .filter(([k]) => k !== 'status' && k !== 'service' && k !== 'version')
                        .map(([k, v]) => (
                          <Typography key={k} fontSize={11} color="text.secondary">
                            {k}: <strong>{String(v)}</strong>
                          </Typography>
                        ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Monitoring links */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BarChart color="action" />
                <Typography variant="h6" fontWeight={600}>Grafana Dashboards</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Pre-built dashboard with request rates, latency, error rates, orders placed and reports generated.
              </Typography>
              <Button
                variant="contained"
                startIcon={<OpenInNew />}
                href="http://localhost/grafana"
                target="_blank"
                sx={{ borderRadius: 2 }}
              >
                Open Grafana
              </Button>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                Login: admin / vrdcapital123
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Timeline color="action" />
                <Typography variant="h6" fontWeight={600}>Prometheus Metrics</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Raw Prometheus query interface for all service metrics. All services expose <code>/metrics</code>.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<OpenInNew />}
                href="http://localhost:9090"
                target="_blank"
                sx={{ borderRadius: 2 }}
              >
                Open Prometheus
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Memory color="action" />
                <Typography variant="h6" fontWeight={600}>Service API Docs</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Each microservice exposes interactive Swagger docs at <code>/docs</code>.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(SERVICE_PORTS).map(([name, port]) => (
                  <Button
                    key={name}
                    size="small"
                    variant="outlined"
                    href={`http://localhost:${port}/docs`}
                    target="_blank"
                    sx={{ borderRadius: 2, fontSize: 12 }}
                  >
                    {name} :{port}
                  </Button>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
