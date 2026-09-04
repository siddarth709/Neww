import { useEffect, useRef, useState, useCallback } from "react";

const API_WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws/dashboard";
const RECONNECT_DELAY_MS = 2000;


export function useDashboardSocket() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [nodeStats, setNodeStats] = useState({});
  const [roundHistory, setRoundHistory] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem("verify_session");
    let wsUrl = API_WS_URL;
    try {
      const session = token ? JSON.parse(token) : null;
      if (session?.token) {
        wsUrl += `${wsUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(session.token)}`;
      }
    } catch {}
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (msg) => {
      const event = JSON.parse(msg.data);
      setEvents((prev) => [event, ...prev].slice(0, 200));

      if (event.node) {
        setNodeStats((prev) => {
          const current = prev[event.node] || { accepted: 0, flagged: 0, scores: [], reputation: 100 };
          const next = { ...current };
          if (event.type === "gradient_verified") next.accepted += 1;
          if (event.type === "gradient_flagged") next.flagged += 1;
          if (typeof event.anomaly_score === "number") next.scores = [...current.scores, event.anomaly_score].slice(-20);
          if (typeof event.reputation === "number") next.reputation = event.reputation;
          return { ...prev, [event.node]: next };
        });
      }

      if (event.type === "round_finalized") {
        setRoundHistory((prev) => [...prev, event].slice(-30));
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, events, nodeStats, roundHistory };
}
