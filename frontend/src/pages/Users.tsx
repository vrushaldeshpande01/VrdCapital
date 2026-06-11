import { Box, Typography, Card, CardContent } from '@mui/material';
import { AdminPanelSettings } from '@mui/icons-material';

export default function UsersPage() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>User Management</Typography>
      <Card>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <AdminPanelSettings sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">User Management</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Create and manage Admin, Portfolio Manager, and Client user accounts.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
