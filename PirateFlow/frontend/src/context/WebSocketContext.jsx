import { createContext, useContext, useEffect, useRef, useState } from "react";
import { tokenStorage } from "../api/client";

const WebSocketContext = createContext(null);

const WS_URL = import.meta.env.PROD
  ? "wss://pirateflow.net/ws"
  : "wss://pirateflow.net/ws";

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const wsRef = useRef(null);
  const listenersRef = useRef({});
  const reconnectDelay = useRef(1000);
  const reconnectTimer = useRef(null);
  const manualClose = useRef(false);

  const on = (eventName, callback) => {
    if (!listenersRef.current[eventName]) {
      listenersRef.current[eventName] = [];
    }
    listenersRef.current[eventName].push(callback);
  };

  const off = (eventName, callback) => {
    if (!listenersRef.current[eventName]) return;
    listenersRef.current[eventName] = listenersRef.current[eventName].filter(
      (cb) => cb !== callback
    );
  };

  const emit = (eventName, data) => {
    const handlers = listenersRef.current[eventName] || [];
    handlers.forEach((cb) => cb(data));
    setLastEvent({ event: eventName, data, timestamp: new Date().toISOString() });
  };

  const connect = () => {
    try {
      const token = tokenStorage.getAccess();
      const url = token ? `${WS_URL}?token=${token}` : WS_URL;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectDelay.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const eventName = parsed.event || parsed.type;
          const data = parsed.data || parsed;
          if (eventName) {
            const handlers = listenersRef.current[eventName] || [];
            handlers.forEach((cb) => cb(data));
            setLastEvent({ event: eventName, data, timestamp: new Date().toISOString() });
          }
        } catch {
          // Non-JSON message — ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!manualClose.current) {
          // Auto-reconnect with exponential backoff
          reconnectTimer.current = setTimeout(() => {
            reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
            connect();
          }, reconnectDelay.current);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not available — fall back to simulated connected state
      setConnected(true);
    }
  };

  useEffect(() => {
    manualClose.current = false;
    connect();

    return () => {
      manualClose.current = true;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WebSocketContext.Provider value={{ connected, lastEvent, on, off, emit }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}