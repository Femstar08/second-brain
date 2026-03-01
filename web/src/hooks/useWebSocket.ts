import { useState, useEffect, useRef, useCallback } from "react";
import { createWSClient, type WSServerMessage, type WSStatus } from "@/lib/ws-client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export function useWebSocket() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const [isTyping, setIsTyping] = useState(false);
  const clientRef = useRef<ReturnType<typeof createWSClient> | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const client = createWSClient(wsUrl);
    clientRef.current = client;

    const unsubStatus = client.onStatusChange(setStatus);
    const unsubMessage = client.onMessage((msg: WSServerMessage) => {
      if (msg.type === "typing") {
        setIsTyping(true);
      } else if (msg.type === "response") {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: msg.text,
            timestamp: Date.now(),
          },
        ]);
      } else if (msg.type === "error") {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `Error: ${msg.message}`,
            timestamp: Date.now(),
          },
        ]);
      }
    });

    client.connect();

    return () => {
      unsubStatus();
      unsubMessage();
      client.disconnect();
    };
  }, []);

  const sendMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        text,
        timestamp: Date.now(),
      },
    ]);
    clientRef.current?.send(text);
  }, []);

  return { messages, status, isTyping, sendMessage };
}
