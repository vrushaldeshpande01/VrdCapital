import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, IconButton, Alert, CircularProgress,
  Divider,
} from '@mui/material';
import {
  Visibility, VisibilityOff, TrendingUp as LogoIcon,
  Lock as LockIcon, Person as PersonIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store';
import { login } from '@/store/authSlice';
import { useSnackbar } from 'notistack';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const isLoading = useAppSelector((s) => s.auth.isLoading);

  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password) {
      setError('Please fill in all fields');
      return;
    }
    const result = await dispatch(login(form));
    if (login.fulfilled.match(result)) {
      enqueueSnackbar('Welcome back!', { variant: 'success' });
      navigate('/dashboard');
    } else {
      setError((result.payload as string) || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #00897b 100%)',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.15)', mb: 2,
            }}
          >
            <LogoIcon sx={{ fontSize: 36, color: '#fff' }} />
          </Box>
          <Typography variant="h4" fontWeight={700} color="#fff" gutterBottom>
            VrdCapital
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Portfolio Management Platform
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Sign In
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your credentials to access the platform
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <TextField
                fullWidth
                label="Username or Email"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                margin="normal"
                autoComplete="username"
                autoFocus
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                margin="normal"
                autoComplete="current-password"
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{ mt: 3, mb: 1, borderRadius: 2, py: 1.4, fontWeight: 700 }}
              >
                {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
              </Button>
            </form>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                Default Admin Credentials
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Username: <strong>admin</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Password: <strong>Admin@123</strong>
              </Typography>
            </Box>
          </CardContent>
        </Card>

        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 3, color: 'rgba(255,255,255,0.5)' }}>
          © 2025 VrdCapital. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}
