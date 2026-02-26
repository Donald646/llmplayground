"use client";

import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { MessageResponse } from "@/components/ai-elements/message";
import type { ChatMessage } from "@/lib/games/wordle-types";

export function ChatPanel({
  title = "Chat",
  messages,
}: {
  title?: string;
  messages: ChatMessage[];
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-muted/20">
      <div className="border-b border-border/50 px-3 py-2">
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Models will chat here...
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="mb-2">
            <div className="flex items-baseline gap-1.5">
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {m.modelName}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                R{m.round}
              </span>
            </div>
            <div className="mt-0.5 pl-1">
              <MessageResponse className="text-xs">
                {m.text}
              </MessageResponse>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
