import { Box, Typography, Card, CardContent } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';

export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>Settings</Typography>
      <Card>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <SettingsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">Platform Settings</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Configure platform settings, integrations, and preferences.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
