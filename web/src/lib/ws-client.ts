export type WSServerMessage =
  | { type: "typing" }
  | { type: "chunk"; text: string }
  | { type: "response"; text: string; done: true }
  | { type: "error"; message: string };

export type WSStatus = "connecting" | "connected" | "disconnected";

export interface WSClient {
  send(text: string): void;
  onMessage(handler: (msg: WSServerMessage) => void): () => void;
  onStatusChange(handler: (status: WSStatus) => void): () => void;
  connect(): void;
  disconnect(): void;
}

export function createWSClient(url: string): WSClient {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;
  const messageHandlers = new Set<(msg: WSServerMessage) => void>();
  const statusHandlers = new Set<(status: WSStatus) => void>();

  function setStatus(status: WSStatus) {
    statusHandlers.forEach((h) => h(status));
  }

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus("connecting");
    ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      setStatus("connected");
      reconnectDelay = 1000;
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data) as WSServerMessage;
        messageHandlers.forEach((h) => h(msg));
      } catch {
        // Ignore malformed messages
      }
    });

    ws.addEventListener("close", () => {
      setStatus("disconnected");
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        connect();
      }, reconnectDelay);
    });

    ws.addEventListener("error", () => {
      ws?.close();
    });
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    reconnectTimer = null;
    ws?.close();
    ws = null;
  }

  return {
    send(text: string) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "message", text }));
      }
    },
    onMessage(handler) {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },
    onStatusChange(handler) {
      statusHandlers.add(handler);
      return () => {
        statusHandlers.delete(handler);
      };
    },
    connect,
    disconnect,
  };
}
