import ReactMarkdown from "react-markdown";
import type { ChatMessage as ChatMessageType } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
}

function MediaPreview({ media }: { media: NonNullable<ChatMessageType["media"]> }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {media.map((m, i) => {
        if (m.type === "image") {
          return (
            <img
              key={i}
              src={`/api/media/${m.path.split("/").pop()}`}
              alt={m.originalName ?? "image"}
              className="max-w-[200px] max-h-[200px] rounded object-cover"
            />
          );
        }
        if (m.type === "audio") {
          return (
            <audio key={i} controls className="max-w-[250px]">
              <source src={`/api/media/${m.path.split("/").pop()}`} type={m.mimeType} />
            </audio>
          );
        }
        return (
          <div key={i} className="text-xs bg-muted/50 rounded px-2 py-1">
            {m.originalName ?? "document"}
          </div>
        );
      })}
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {isUser ? "Y" : "C"}
      </div>
      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[80%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? (
          <>
            <p className="text-sm whitespace-pre-wrap">{message.text}</p>
            {message.media && <MediaPreview media={message.media} />}
          </>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
