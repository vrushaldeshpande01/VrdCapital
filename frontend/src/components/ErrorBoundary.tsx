import { Component, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ErrorOutline } from '@mui/icons-material';

interface Props { children: ReactNode; }
interface State { hasError: boolean; message: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error) {
    console.error('[ErrorBoundary]', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 2, p: 4 }}>
          <ErrorOutline sx={{ fontSize: 56, color: 'error.main' }} />
          <Typography variant="h6" fontWeight={700}>Something went wrong</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, textAlign: 'center' }}>
            {this.state.message || 'An unexpected error occurred on this page.'}
          </Typography>
          <Button variant="contained" onClick={() => this.setState({ hasError: false, message: '' })}>
            Try Again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
