"""WebSocket endpoint and connection manager for real-time updates.

Events the backend emits (consumed by frontend):
    occupancy_changed  -> all admins
    booking_created    -> all admins + booking owner
    booking_cancelled  -> all admins + booking owner
    anomaly_alert      -> all admins
    demo_tick          -> all connected clients

Auth:
    Browser WebSockets can't send custom headers, so the JWT is passed
    as a query parameter: /ws?token=<jwt>
    The token is validated on connect. Invalid tokens get close code 4001.

Heartbeat:
    Server sends a ping every 30 seconds. If the client doesn't respond
    (connection is dead), the next ping will raise an exception and trigger
    cleanup.
"""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from middleware.auth import _decode_token

router = APIRouter(tags=["websocket"])

HEARTBEAT_INTERVAL = 30  # seconds


class ConnectionManager:
    """Tracks active WebSocket connections by user role."""

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}  # user_id -> ws
        self._roles: dict[str, str] = {}  # user_id -> role

    async def connect(self, websocket: WebSocket, user_id: str, role: str):
        await websocket.accept()
        self._connections[user_id] = websocket
        self._roles[user_id] = role

    def disconnect(self, user_id: str):
        self._connections.pop(user_id, None)
        self._roles.pop(user_id, None)

    async def send_to_user(self, user_id: str, event: str, data: dict):
        """Send an event to a specific user. Cleans up if the connection is dead."""
        ws = self._connections.get(user_id)
        if ws is None:
            return
        try:
            await ws.send_json({
                "event": event,
                "data": data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            self.disconnect(user_id)

    async def broadcast_to_admins(self, event: str, data: dict):
        """Send an event to all connected admin users."""
        msg = {
            "event": event,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        # Snapshot the keys to avoid dict-changed-during-iteration
        stale = []
        for user_id in list(self._connections):
            if self._roles.get(user_id) != "admin":
                continue
            ws = self._connections.get(user_id)
            if ws is None:
                continue
            try:
                await ws.send_json(msg)
            except Exception:
                stale.append(user_id)
        for uid in stale:
            self.disconnect(uid)

    async def broadcast_all(self, event: str, data: dict):
        """Send an event to all connected clients."""
        msg = {
            "event": event,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        stale = []
        for user_id in list(self._connections):
            ws = self._connections.get(user_id)
            if ws is None:
                continue
            try:
                await ws.send_json(msg)
            except Exception:
                stale.append(user_id)
        for uid in stale:
            self.disconnect(uid)

    @property
    def active_count(self) -> int:
        return len(self._connections)


# Singleton — imported by demo.py, main.py, and any router that emits events
manager = ConnectionManager()


async def _heartbeat(websocket: WebSocket, user_id: str):
    """Send periodic pings to detect dead connections."""
    try:
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            # If the connection is already closed, stop
            if websocket.client_state != WebSocketState.CONNECTED:
                break
            try:
                await websocket.send_json({"event": "ping", "timestamp": datetime.now(timezone.utc).isoformat()})
            except Exception:
                break
    except asyncio.CancelledError:
        pass
    finally:
        manager.disconnect(user_id)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    """WebSocket connection for real-time dashboard updates.

    Connect with: ws://<host>/ws?token=<jwt_access_token>
    """
    # Authenticate via token query param
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    user = _decode_token(token)
    if user is None:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    user_id = user.user_id
    role = user.role.value

    await manager.connect(websocket, user_id, role)

    # Start heartbeat in the background
    heartbeat_task = asyncio.create_task(_heartbeat(websocket, user_id))

    try:
        while True:
            data = await websocket.receive_text()
            # Client can send ping/pong
            if data == "ping":
                await websocket.send_json({"event": "pong", "timestamp": datetime.now(timezone.utc).isoformat()})
    except WebSocketDisconnect:
        pass
    finally:
        heartbeat_task.cancel()
        manager.disconnect(user_id)
