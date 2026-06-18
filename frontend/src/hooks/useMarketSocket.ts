/**
 * Singleton WebSocket connection to /ws/notifications.
 * Dispatches a custom 'market-tick' DOM event for each MARKET_TICK message
 * so any component can subscribe without re-opening the socket.
 */
import { useEffect, useRef } from 'react';
import { useAppSelector } from '@/store';

let _ws: WebSocket | null = null;
let _refCount = 0;

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws/notifications`;
}

function openSocket(token: string) {
  if (_ws && _ws.readyState < 2) return; // already open/connecting
  _ws = new WebSocket(`${getWsUrl()}?token=${token}`);
  _ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'MARKET_TICK') {
        window.dispatchEvent(new CustomEvent('market-tick', { detail: data }));
      }
    } catch {}
  };
  _ws.onclose = () => {
    _ws = null;
    // Reconnect after 3 s if there are still active consumers
    if (_refCount > 0) setTimeout(() => {
      if (token) openSocket(token);
    }, 3000);
  };
}

export function useMarketSocket() {
  const token = useAppSelector((s) => s.auth.access_token);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) return;
    _refCount++;
    openSocket(token);
    return () => {
      _refCount--;
      if (_refCount === 0 && _ws) {
        _ws.close();
        _ws = null;
      }
    };
  }, [token]);
}
