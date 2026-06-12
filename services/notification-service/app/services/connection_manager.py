"""
WebSocket connection manager.
Tracks active WebSocket connections per user_id.
Broadcasts notification payloads to all open sockets for a user.
"""
import asyncio
import json
from collections import defaultdict
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # user_id -> list of active WebSocket connections
        self._connections: Dict[str, List[WebSocket]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections[user_id].append(ws)

    async def disconnect(self, user_id: str, ws: WebSocket):
        async with self._lock:
            conns = self._connections.get(user_id, [])
            if ws in conns:
                conns.remove(ws)

    async def send_to_user(self, user_id: str, payload: dict):
        """Send JSON payload to all WebSocket connections for a user."""
        message = json.dumps(payload)
        async with self._lock:
            conns = list(self._connections.get(user_id, []))
        dead = []
        for ws in conns:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(user_id, ws)

    async def broadcast(self, payload: dict):
        """Send to all connected users (admin broadcasts)."""
        message = json.dumps(payload)
        async with self._lock:
            all_conns = [(uid, ws) for uid, conns in self._connections.items() for ws in conns]
        dead = []
        for uid, ws in all_conns:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append((uid, ws))
        for uid, ws in dead:
            await self.disconnect(uid, ws)

    @property
    def connected_users(self) -> int:
        return sum(len(v) for v in self._connections.values())


manager = ConnectionManager()
