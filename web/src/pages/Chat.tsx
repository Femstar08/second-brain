import { useRef, useEffect } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { MessageInput } from "@/components/MessageInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function Chat() {
  const { messages, status, isTyping, sendMessage } = useWebSocket();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-full">
      {status === "disconnected" && (
        <div className="bg-destructive/10 text-destructive text-sm text-center py-2">
          Reconnecting...
        </div>
      )}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && !isTyping && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">Hello, I'm Clio</p>
              <p className="text-sm mt-1">
                Your personal AI assistant. Send me a message to get started.
              </p>
            </div>
          </div>
        )}
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                C
              </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <span className="animate-pulse text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto">
          <MessageInput onSend={sendMessage} disabled={status !== "connected"} />
        </div>
      </div>
    </div>
  );
}
