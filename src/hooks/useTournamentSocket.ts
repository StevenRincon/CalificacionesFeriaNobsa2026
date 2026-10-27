import { useState, useEffect, useRef, useCallback } from 'react';
import { TournamentState, WSMessage, LineAttempt, Project } from '../types.ts';
import { INITIAL_TOURNAMENT_STATE } from '../data/defaultData.ts';

export function useTournamentSocket() {
  const [state, setState] = useState<TournamentState>(() => ({
    ...INITIAL_TOURNAMENT_STATE,
    projects: [],
    activityLog: [],
  }));
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessageTime, setLastMessageTime] = useState<number>(Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef<number>(1000);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectDelayRef.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.type === 'INIT' || msg.type === 'STATE_UPDATED') {
            setState(msg.payload);
            setLastMessageTime(Date.now());
          } else if (msg.type === 'ERROR') {
            console.error('WebSocket request rejected:', msg.payload.message);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Back off between reconnects so transient DB/network outages do not create request bursts.
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay + Math.floor(Math.random() * 300));
      };

      ws.onerror = (err) => {
        console.warn('WebSocket encountered error, falling back to HTTP sync if needed', err);
        ws.close();
      };
    } catch (e) {
      console.error('Error instantiating WebSocket:', e);
      setIsConnected(false);
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectDelayRef.current = 1000;
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
    }
    socketRef.current = null;
    connect();
  }, [connect]);

  const refreshProjects = useCallback(async () => {
    const response = await fetch('/api/projects');
    const result: { projects?: Project[]; error?: string } = await response.json();
    if (!response.ok) throw new Error(result.error || `El servidor respondió ${response.status} al cargar proyectos.`);
    if (!Array.isArray(result.projects)) throw new Error('La API no devolvió una lista de proyectos válida.');
    setState((current) => ({ ...current, projects: result.projects! }));
  }, []);

  useEffect(() => {
    connect();

    refreshProjects().catch((error: unknown) => console.error('No se pudieron cargar los proyectos inscritos:', error));

    // Fallback initial HTTP fetch
    fetch('/api/state')
      .then(async (res) => {
        if (!res.ok) {
          const result: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(result.error || `El servidor respondió ${res.status} al cargar el estado. Revisa /api/health.`);
        }
        return res.json() as Promise<TournamentState>;
      })
      .then((data) => {
        if (data && data.projects) {
          setState(data);
        }
      })
      .catch((error: unknown) => console.error('No se pudo cargar el estado desde el servidor:', error));

    // Heartbeat ping
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 20000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, refreshProjects]);

  const sendWsMessage = useCallback((msg: WSMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      // Fallback via HTTP
      const request = msg.type === 'SUBMIT_SCORE'
        ? fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload),
        })
        : msg.type === 'SUBMIT_LINE_ATTEMPT'
        ? fetch('/api/line-attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload),
        })
        : msg.type === 'UPDATE_EVENT_STATUS'
        ? fetch('/api/event/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload),
        })
        : undefined;
      request
        ?.then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'No se pudo guardar el cambio.');
          if (result.state) setState(result.state as TournamentState);
        })
        .catch((error: unknown) => console.error('No se pudo guardar el cambio:', error));
    }
  }, []);

  const submitScore = useCallback(
    (projectId: string, jurorId: string, jurorName: string, scores: Record<string, number>, feedback?: string) => {
      sendWsMessage({
        type: 'SUBMIT_SCORE',
        payload: { projectId, jurorId, jurorName, scores, feedback },
      });
    },
    [sendWsMessage]
  );

  const submitLineAttempt = useCallback(
    (projectId: string, attempt: LineAttempt) => {
      sendWsMessage({
        type: 'SUBMIT_LINE_ATTEMPT',
        payload: { projectId, attempt },
      });
    },
    [sendWsMessage]
  );

  const updateEventStatus = useCallback(
    (status: TournamentState['status']) => {
      sendWsMessage({
        type: 'UPDATE_EVENT_STATUS',
        payload: { status },
      });
    },
    [sendWsMessage]
  );

  return {
    state,
    isConnected,
    lastMessageTime,
    reconnect,
    refreshProjects,
    submitScore,
    submitLineAttempt,
    updateEventStatus,
  };
}
