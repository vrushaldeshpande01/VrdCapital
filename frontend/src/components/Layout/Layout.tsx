import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import Header from './Header';
import LivePriceTicker from '@/components/LivePriceTicker';

const DRAWER_WIDTH = 260;

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar
        drawerWidth={DRAWER_WIDTH}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Header drawerWidth={DRAWER_WIDTH} onMenuClick={() => setMobileOpen(true)} />
        <Box sx={{ mt: 8 }}>
          <LivePriceTicker />
        </Box>
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
