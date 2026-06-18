import { useState, useEffect } from 'react';
import { brokerApi } from '@/api/client';

export interface LivePrice {
  ltp: number;
  change: number;
  change_pct: number;
  ts: string;
}

/**
 * Subscribe to live price ticks for a symbol.
 * On mount, also calls the REST cache so we get an immediate value
 * rather than waiting for the next 2-second tick.
 */
export function useLivePrice(symbol: string | null): LivePrice | null {
  const [price, setPrice] = useState<LivePrice | null>(null);

  // Seed from REST cache
  useEffect(() => {
    if (!symbol) return;
    brokerApi
      .get<LivePrice & { cached: boolean }>(`/market/ticker/ltp/${symbol}`)
      .then((r) => { if (r.data.ltp != null) setPrice(r.data as LivePrice); })
      .catch(() => {});
  }, [symbol]);

  // Live updates via WebSocket
  useEffect(() => {
    if (!symbol) return;
    const handler = (e: Event) => {
      const d = (e as CustomEvent<LivePrice & { symbol: string }>).detail;
      if (d.symbol === symbol.toUpperCase()) setPrice(d);
    };
    window.addEventListener('market-tick', handler);
    return () => window.removeEventListener('market-tick', handler);
  }, [symbol]);

  return price;
}

/**
 * Subscribe to live ticks for multiple symbols at once.
 * Returns a map of SYMBOL → LivePrice.
 */
export function useLivePrices(symbols: string[]): Record<string, LivePrice> {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});

  useEffect(() => {
    if (!symbols.length) return;
    const handler = (e: Event) => {
      const d = (e as CustomEvent<LivePrice & { symbol: string }>).detail;
      if (symbols.includes(d.symbol)) {
        setPrices((p) => ({ ...p, [d.symbol]: d }));
      }
    };
    window.addEventListener('market-tick', handler);
    return () => window.removeEventListener('market-tick', handler);
  }, [symbols.join(',')]);

  return prices;
}
