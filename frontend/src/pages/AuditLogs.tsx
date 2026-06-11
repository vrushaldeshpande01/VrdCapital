import { Box, Typography, Card, CardContent } from '@mui/material';
import { Security } from '@mui/icons-material';

export default function AuditLogsPage() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Audit Logs</Typography>
      <Card>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Security sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">Audit Trail</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Complete audit trail of all operations across the platform.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
