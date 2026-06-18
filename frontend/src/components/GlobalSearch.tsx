import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogContent, TextField, List, ListItemButton,
  ListItemText, ListItemIcon, Box, Typography, Chip, Divider,
  InputAdornment, CircularProgress,
} from '@mui/material';
import { Search, Person, ShowChart, ReceiptLong, Assessment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clientsService } from '@/api/clients';
import { brokerService } from '@/api/broker';
import { useAppDispatch } from '@/store';
import { openOrderModal } from '@/store/tradingSlice';

interface Result {
  id: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  chip?: string;
  chipColor?: 'primary' | 'success' | 'warning' | 'error' | 'default';
  action: () => void;
}

const STATIC_LINKS: Result[] = [];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [symbolResults, setSymbolResults] = useState<any[]>([]);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const symbolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: clientsData } = useQuery({
    queryKey: ['clients-search'],
    queryFn: () => clientsService.list({ page: 1, size: 100 }).then(r => r.items),
    staleTime: 60_000,
  });

  // Debounced symbol search
  useEffect(() => {
    if (!q.trim() || q.length < 2) { setSymbolResults([]); return; }
    if (symbolTimer.current) clearTimeout(symbolTimer.current);
    symbolTimer.current = setTimeout(async () => {
      setSymbolLoading(true);
      try {
        const res = await brokerService.searchSymbols(q);
        setSymbolResults(res.data.results?.slice(0, 5) ?? []);
      } catch { setSymbolResults([]); }
      finally { setSymbolLoading(false); }
    }, 300);
  }, [q]);

  const close = useCallback(() => { setOpen(false); setQ(''); setSymbolResults([]); }, []);

  const matchedClients: Result[] = (clientsData ?? [])
    .filter((c: any) =>
      !q.trim() ||
      c.full_name.toLowerCase().includes(q.toLowerCase()) ||
      c.email?.toLowerCase().includes(q.toLowerCase()) ||
      c.pan_number?.toLowerCase().includes(q.toLowerCase())
    )
    .slice(0, 5)
    .map((c: any) => ({
      id: `client-${c.id}`,
      label: c.full_name,
      sub: c.email,
      icon: <Person fontSize="small" />,
      chip: c.status,
      chipColor: c.status === 'active' ? 'success' : 'default',
      action: () => { navigate(`/clients/${c.id}`); close(); },
    }));

  const symbolItems: Result[] = symbolResults.map((s: any) => ({
    id: `sym-${s.symbol}`,
    label: s.symbol,
    sub: s.name ?? s.symbol,
    icon: <ShowChart fontSize="small" />,
    chip: s.exchange ?? 'NSE',
    chipColor: 'primary',
    action: () => {
      dispatch(openOrderModal({ instrument: {
        id: s.symbol,
        symbol: s.symbol,
        name: s.name ?? s.symbol,
        exchange: s.exchange ?? 'NSE',
        instrument_type: 'EQUITY',
        lot_size: 1,
        tick_size: '0.05',
        ltp: String(s.ltp ?? 0),
      }, side: 'BUY' }));
      close();
    },
  }));

  const navItems: Result[] = (q.trim()
    ? [
        { id: 'nav-orders',    label: 'Orders',    sub: 'View all orders',       icon: <ReceiptLong fontSize="small" />,   action: () => { navigate('/orders');    close(); } },
        { id: 'nav-portfolio', label: 'Portfolio', sub: 'Holdings & P&L',        icon: <Assessment fontSize="small" />,   action: () => { navigate('/portfolio'); close(); } },
        { id: 'nav-reports',   label: 'Reports',   sub: 'Generate PDF / XLSX',   icon: <Assessment fontSize="small" />,   action: () => { navigate('/reports');   close(); } },
        { id: 'nav-clients',   label: 'Clients',   sub: 'Manage client accounts', icon: <Person fontSize="small" />,      action: () => { navigate('/clients');   close(); } },
      ].filter(n => n.label.toLowerCase().includes(q.toLowerCase()) || n.sub?.toLowerCase().includes(q.toLowerCase()))
    : [
        { id: 'nav-dashboard', label: 'Dashboard',  sub: 'AUM overview',           icon: <Assessment fontSize="small" />,   action: () => { navigate('/dashboard'); close(); } },
        { id: 'nav-clients',   label: 'Clients',    sub: 'Manage client accounts', icon: <Person fontSize="small" />,       action: () => { navigate('/clients');  close(); } },
        { id: 'nav-portfolio', label: 'Portfolio',  sub: 'Holdings & P&L',         icon: <Assessment fontSize="small" />,  action: () => { navigate('/portfolio'); close(); } },
        { id: 'nav-trading',   label: 'Trading',    sub: 'Place orders',           icon: <ShowChart fontSize="small" />,    action: () => { navigate('/trading');  close(); } },
        { id: 'nav-reports',   label: 'Reports',    sub: 'Generate PDF / XLSX',    icon: <Assessment fontSize="small" />,  action: () => { navigate('/reports');  close(); } },
      ]
  );

  const sections: { label: string; items: Result[] }[] = [];
  if (matchedClients.length) sections.push({ label: 'Clients', items: matchedClients });
  if (symbolItems.length)    sections.push({ label: 'Trade Symbol', items: symbolItems });
  if (navItems.length)       sections.push({ label: q.trim() ? 'Pages' : 'Quick Navigation', items: navItems });

  const allResults = sections.flatMap(s => s.items);
  const [cursor, setCursor] = useState(0);

  useEffect(() => { setCursor(0); }, [q, open]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, allResults.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && allResults[cursor]) { allResults[cursor].action(); }
  };

  return (
    <>
      {/* Trigger button in Header — rendered via portal via Layout */}
      <Box
        onClick={() => setOpen(true)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 0.75, borderRadius: 2,
          border: '1px solid', borderColor: 'divider',
          cursor: 'pointer', bgcolor: 'background.paper',
          color: 'text.secondary', minWidth: 220,
          '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
          transition: 'all 0.15s',
        }}
      >
        <Search sx={{ fontSize: 18 }} />
        <Typography variant="body2" sx={{ flexGrow: 1 }}>Search…</Typography>
        <Chip label="Ctrl+K" size="small" sx={{ height: 20, fontSize: 10, cursor: 'pointer' }} />
      </Box>

      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3, mt: '10vh', verticalAlign: 'top' } }}
        TransitionProps={{ unmountOnExit: true }}
      >
        <DialogContent sx={{ p: 0 }}>
          <TextField
            autoFocus
            fullWidth
            placeholder="Search clients, symbols, pages…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKey}
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {symbolLoading ? <CircularProgress size={18} /> : <Search />}
                </InputAdornment>
              ),
              sx: { borderRadius: '12px 12px 0 0', fontSize: '1rem', py: 0.5 },
            }}
            sx={{ '& fieldset': { border: 'none' }, borderBottom: '1px solid', borderColor: 'divider' }}
          />

          {sections.length === 0 && q.trim() && !symbolLoading && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">No results for "{q}"</Typography>
            </Box>
          )}

          <List dense sx={{ maxHeight: 420, overflowY: 'auto', py: 0.5 }}>
            {(() => {
              let idx = 0;
              return sections.map((section, si) => (
                <Box key={section.label}>
                  <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {section.label}
                  </Typography>
                  {section.items.map(item => {
                    const i = idx++;
                    return (
                      <ListItemButton
                        key={item.id}
                        selected={cursor === i}
                        onClick={item.action}
                        onMouseEnter={() => setCursor(i)}
                        sx={{ mx: 1, borderRadius: 1.5, mb: 0.25 }}
                      >
                        <ListItemIcon sx={{ minWidth: 32, color: cursor === i ? 'primary.main' : 'text.secondary' }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={<Typography variant="body2" fontWeight={600}>{item.label}</Typography>}
                          secondary={item.sub && <Typography variant="caption" color="text.secondary">{item.sub}</Typography>}
                        />
                        {item.chip && (
                          <Chip label={item.chip} size="small" color={item.chipColor ?? 'default'} sx={{ height: 18, fontSize: 10 }} />
                        )}
                      </ListItemButton>
                    );
                  })}
                  {si < sections.length - 1 && <Divider sx={{ my: 0.5 }} />}
                </Box>
              ));
            })()}
          </List>

          <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 2 }}>
            {[['↑↓', 'navigate'], ['↵', 'select'], ['Esc', 'close']].map(([k, v]) => (
              <Box key={k} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Chip label={k} size="small" sx={{ height: 18, fontSize: 10 }} />
                <Typography variant="caption" color="text.secondary">{v}</Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
