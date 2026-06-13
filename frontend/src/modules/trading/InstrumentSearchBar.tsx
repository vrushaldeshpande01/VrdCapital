import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box, TextField, Paper, List, ListItemButton, ListItemText,
  Typography, Chip, CircularProgress, InputAdornment, ClickAwayListener,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useQuery } from '@tanstack/react-query';
import { tradingService, Instrument } from '@/api/trading';
import { useAppDispatch } from '@/store';
import { openOrderModal } from '@/store/tradingSlice';

interface Props {
  clientId?: string;
}

const TYPE_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'warning'> = {
  EQUITY: 'primary', FUTURES: 'warning', OPTIONS: 'secondary', CURRENCY: 'default',
};

export default function InstrumentSearchBar({ clientId }: Props) {
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQ(val);
      if (val.length > 0) setOpen(true);
    }, 300);
  }, []);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['instruments-search', debouncedQ],
    queryFn: () => tradingService.searchInstruments(debouncedQ).then((r) => r.data),
    enabled: debouncedQ.length > 0,
  });

  const handleSelect = (instr: Instrument) => {
    setQuery('');
    setDebouncedQ('');
    setOpen(false);
    dispatch(openOrderModal({ instrument: instr, side: 'BUY', clientId: clientId ?? undefined }));
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', width: 320 }}>
        <TextField
          size="small"
          placeholder="Search instruments… (RELIANCE, INFY…)"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {isFetching ? <CircularProgress size={14} /> : <SearchIcon fontSize="small" />}
              </InputAdornment>
            ),
          }}
          sx={{ width: '100%' }}
        />
        {open && results.length > 0 && (
          <Paper
            elevation={8}
            sx={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300,
              maxHeight: 300, overflowY: 'auto', mt: 0.5, borderRadius: 2,
            }}
          >
            <List dense disablePadding>
              {results.map((instr) => {
                const ltp = Number(instr.ltp);
                return (
                  <ListItemButton
                    key={instr.id}
                    onClick={() => handleSelect(instr)}
                    sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={700}>{instr.symbol}</Typography>
                          <Chip
                            label={instr.instrument_type}
                            size="small"
                            color={TYPE_COLORS[instr.instrument_type] ?? 'default'}
                            sx={{ height: 16, fontSize: '0.6rem' }}
                          />
                          <Chip label={instr.exchange} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {instr.name}
                        </Typography>
                      }
                    />
                    <Box sx={{ textAlign: 'right', ml: 2 }}>
                      <Typography variant="body2" fontWeight={700}>₹{ltp.toLocaleString('en-IN')}</Typography>
                    </Box>
                  </ListItemButton>
                );
              })}
            </List>
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
}
