import { createContext, useContext, useEffect, useRef, useState } from "react";

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const wsRef = useRef(null);
  const listenersRef = useRef({});
  const reconnectDelay = useRef(1000);

  const connect = () => {
    try {
      // When backend WebSocket is ready, replace with:
      // wsRef.current = new WebSocket("ws://localhost:5000/ws");
      // For now we simulate connection
      setConnected(true);
      reconnectDelay.current = 1000;
    } catch (err) {
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    setConnected(false);
    setTimeout(() => {
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
      connect();
    }, reconnectDelay.current);
  };

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

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, lastEvent, on, off, emit }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}