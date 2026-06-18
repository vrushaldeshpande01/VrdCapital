/**
 * Horizontal scrolling ticker bar showing live NSE prices.
 * Subscribes a default watchlist on mount; receives ticks via 'market-tick' events.
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { brokerService } from '@/api/broker';
import { useLivePrices } from '@/hooks/useLivePrice';
import { useMarketSocket } from '@/hooks/useMarketSocket';

const DEFAULT_SYMBOLS = [
  'NIFTY 50', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK',
  'ICICIBANK', 'BAJFINANCE', 'WIPRO', 'SBIN', 'ADANIENT',
];

// Symbols that can actually be subscribed via REST (no spaces)
const SUBSCRIBABLE = DEFAULT_SYMBOLS.filter((s) => !s.includes(' '));

interface TickItem {
  symbol: string;
  ltp: number;
  change_pct: number;
}

export default function LivePriceTicker() {
  useMarketSocket(); // open/maintain WS connection
  const prices = useLivePrices(SUBSCRIBABLE);
  const [items, setItems] = useState<TickItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe symbols on mount
  useEffect(() => {
    brokerService.subscribeSymbols(SUBSCRIBABLE).catch(() => {});
  }, []);

  // Build display list from prices
  useEffect(() => {
    const list = SUBSCRIBABLE.map((sym) => ({
      symbol: sym,
      ltp: prices[sym]?.ltp ?? 0,
      change_pct: prices[sym]?.change_pct ?? 0,
    }));
    setItems(list);
  }, [prices]);

  // Auto-scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf: number;
    let pos = 0;
    const scroll = () => {
      pos += 0.5;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      raf = requestAnimationFrame(scroll);
    };
    raf = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Box
      sx={{
        bgcolor: '#0d1b2a',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        height: 30,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          px: 2,
          overflowX: 'hidden',
          whiteSpace: 'nowrap',
          cursor: 'default',
          userSelect: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {/* Duplicate items for seamless loop */}
        {[...items, ...items].map((item, idx) => (
          <TickerItem key={`${item.symbol}-${idx}`} item={item} />
        ))}
      </Box>
    </Box>
  );
}

function TickerItem({ item }: { item: TickItem }) {
  const up = item.change_pct >= 0;
  const color = item.ltp === 0 ? '#666' : up ? '#00e676' : '#ff5252';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Typography variant="caption" sx={{ color: '#aaa', fontWeight: 600, fontSize: '0.7rem' }}>
        {item.symbol}
      </Typography>
      {item.ltp > 0 ? (
        <>
          <Typography variant="caption" sx={{ color, fontWeight: 700, fontSize: '0.72rem' }}>
            ₹{item.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
            {up
              ? <TrendingUpIcon sx={{ fontSize: 11, color }} />
              : <TrendingDownIcon sx={{ fontSize: 11, color }} />}
            <Typography variant="caption" sx={{ color, fontSize: '0.68rem' }}>
              {up ? '+' : ''}{item.change_pct.toFixed(2)}%
            </Typography>
          </Box>
        </>
      ) : (
        <Typography variant="caption" sx={{ color: '#555', fontSize: '0.68rem' }}>—</Typography>
      )}
    </Box>
  );
}
