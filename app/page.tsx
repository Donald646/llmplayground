"use client";

import { useChat } from "@ai-sdk/react";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BrainIcon,
  ChevronDownIcon,
  GlobeIcon,
  SearchIcon,
  CodeIcon,
  PenIcon,
  LoaderIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const models = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "xai/grok-4.1-fast-non-reasoning", name: "Grok 4.1 Fast" },
];

const suggestions = [
  "How does AI work?",
  "What's the weather in Tokyo?",
  "Explain quantum computing simply",
  "Write a haiku about programming",
];

const agentMeta: Record<string, { label: string; icon: typeof BrainIcon }> = {
  webSearch: { label: "Web Search", icon: GlobeIcon },
  deepResearchAgent: { label: "Deep Research", icon: SearchIcon },
  codeAgent: { label: "Code Agent", icon: CodeIcon },
  creativeAgent: { label: "Creative Agent", icon: PenIcon },
};

function AgentToolCall({
  toolName,
  part,
}: {
  toolName: string;
  part: any;
}) {
  const [open, setOpen] = useState(false);
  const meta = agentMeta[toolName] ?? {
    label: toolName,
    icon: BrainIcon,
  };
  const Icon = meta.icon;
  const isLoading = part.state !== "output-available";
  const output = part.state === "output-available" ? part.output : null;
  const isWebSearch = toolName === "webSearch";

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 text-sm">
      <button
        type="button"
        onClick={() => !isLoading && setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {isLoading ? (
          <LoaderIcon size={14} className="animate-spin text-muted-foreground" />
        ) : (
          <Icon size={14} className="text-muted-foreground" />
        )}
        <span className="font-medium text-foreground/80">{meta.label}</span>
        {isLoading && (
          <span className="text-xs text-muted-foreground">
            {isWebSearch ? "searching..." : "thinking..."}
          </span>
        )}
        {!isLoading && (
          <ChevronDownIcon
            size={14}
            className={`ml-auto text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {open && output && (
        <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
          {output.result ? (
            <div className="whitespace-pre-wrap">{output.result}</div>
          ) : output.results ? (
            <div className="space-y-1.5">
              {output.results.map((r: any, i: number) => (
                <div key={i}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground/70 hover:underline"
                  >
                    [{i + 1}] {r.title}
                  </a>
                  <p className="mt-0.5 line-clamp-2">{r.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="whitespace-pre-wrap">
              {JSON.stringify(output, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Source = { title: string; url: string; content: string };

function buildSourceNameMap(sources: Source[]): Map<string, number> {
  const map = new Map<string, number>();
  sources.forEach((source, i) => {
    // Numeric index
    map.set(String(i + 1), i);
    try {
      const hostname = new URL(source.url).hostname.replace("www.", "");
      map.set(hostname.toLowerCase(), i);
      // Short name: "ibm" from "ibm.com"
      const short = hostname.split(".")[0];
      if (short.length > 1) map.set(short.toLowerCase(), i);
    } catch {}
    // Name after last separator in title: "What is AI? - AWS" → "AWS"
    const separators = source.title.split(/\s[-|–—]\s/);
    const lastPart = separators[separators.length - 1]?.trim();
    if (lastPart && lastPart.length > 1 && lastPart.length < 40) {
      map.set(lastPart.toLowerCase(), i);
    }
  });
  return map;
}

function prepareCitedMarkdown(text: string, sources: Source[]): string {
  const nameMap = buildSourceNameMap(sources);

  // Split grouped citations: [1, 2, 3] or [IBM, Azure] into individual [X]
  let processed = text.replace(
    /\[([^\]]+(?:,\s*[^\]]+)+)\]/g,
    (_match, inner: string) => {
      const parts = inner.split(/,\s*/);
      const allMatch = parts.every(
        (p) => nameMap.has(p.trim().toLowerCase()) || /^\d+$/.test(p.trim())
      );
      if (allMatch) {
        return parts.map((n) => `[${n.trim()}]`).join("");
      }
      return _match;
    }
  );

  // Replace [X] (not followed by '(' which would be a markdown link) with cite links
  processed = processed.replace(
    /\[([^\]]+)\](?!\()/g,
    (match, inner: string) => {
      // Numeric citation: [1], [2], etc.
      if (/^\d+$/.test(inner)) {
        const idx = parseInt(inner) - 1;
        if (idx >= 0 && idx < sources.length) {
          return `[${inner}](#cite-${idx + 1})`;
        }
        return match;
      }
      // Named citation: [IBM], [Azure], etc.
      const sourceIdx = nameMap.get(inner.toLowerCase());
      if (sourceIdx !== undefined) {
        return `[${inner}](#cite-${sourceIdx + 1})`;
      }
      return match;
    }
  );

  return processed;
}

function CitationLink({
  href,
  children,
  sources,
  ...props
}: {
  href?: string;
  children?: React.ReactNode;
  sources: Source[];
  [key: string]: any;
}) {
  const match = href?.match(/^#cite-(\d+)$/);
  if (match) {
    const source = sources[parseInt(match[1]) - 1];
    if (source) {
      return (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline"
        >
          <InlineCitation>
            <InlineCitationCard>
              <InlineCitationCardTrigger sources={[source.url]} />
              <InlineCitationCardBody>
                <InlineCitationCarousel>
                  <InlineCitationCarouselHeader>
                    <InlineCitationCarouselPrev />
                    <InlineCitationCarouselNext />
                    <InlineCitationCarouselIndex />
                  </InlineCitationCarouselHeader>
                  <InlineCitationCarouselContent>
                    <InlineCitationCarouselItem>
                      <InlineCitationSource
                        title={source.title}
                        url={source.url}
                        description={source.content?.slice(0, 200)}
                      />
                    </InlineCitationCarouselItem>
                  </InlineCitationCarouselContent>
                </InlineCitationCarousel>
              </InlineCitationCardBody>
            </InlineCitationCard>
          </InlineCitation>
        </a>
      );
    }
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

function CitedMessageResponse({
  text,
  sources,
}: {
  text: string;
  sources: Source[];
}) {
  const processedText = prepareCitedMarkdown(text, sources);
  const components = useMemo(
    () => ({
      a: (props: any) => <CitationLink {...props} sources={sources} />,
    }),
    [sources]
  );
  return (
    <MessageResponse components={components}>{processedText}</MessageResponse>
  );
}

function getMessageSources(parts: any[]): Source[] {
  const sources: Source[] = [];
  for (const part of parts) {
    if (part.type?.startsWith("tool-") && part.state === "output-available") {
      // Sources from deepResearchAgent (wrapped in { sources })
      if (part.output?.sources) {
        sources.push(...part.output.sources);
      }
      // Sources from orchestrator webSearch (raw Tavily results)
      if (part.output?.results) {
        for (const r of part.output.results) {
          if (r.url && r.title) {
            sources.push({
              title: r.title,
              url: r.url,
              content: r.content ?? "",
            });
          }
        }
      }
    }
  }
  return sources;
}

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <PromptInputHeader>
      <Attachments variant="inline">
        {attachments.files.map((attachment) => (
          <Attachment
            data={attachment}
            key={attachment.id}
            onRemove={() => attachments.remove(attachment.id)}
          >
            <AttachmentPreview />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
};

export default function Chat() {
  const [model, setModel] = useState(models[0].id);

  const { messages, status, stop, sendMessage } = useChat();

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage(
      {
        text: message.text || "Sent with attachments",
        files: message.files,
      },
      {
        body: { model },
      }
    );
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion }, { body: { model } });
  };

  const isEmpty = messages.length === 0;

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col">
        <nav className="flex items-center gap-4 border-b border-border/50 px-6 py-3">
          <Link href="/" className="text-sm font-medium text-foreground">
            Chat
          </Link>
          <Link
            href="/games"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Games
          </Link>
          <Link
            href="/markets"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Markets
          </Link>
        </nav>
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <div className="w-full max-w-2xl space-y-8">
              <h1 className="text-3xl font-semibold tracking-tight">
                How can I help you?
              </h1>

              <div className="space-y-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestionClick(s)}
                    className="block w-full cursor-pointer rounded-xl px-1 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Conversation className="flex-1">
            <ConversationContent className="mx-auto w-full max-w-2xl gap-4 px-4 py-6">
              {messages.map((message) => {
                const sources = getMessageSources(message.parts as any[]);
                return (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case "text":
                          if (sources.length > 0 && message.role === "assistant") {
                            return (
                              <CitedMessageResponse
                                key={`${message.id}-${i}`}
                                text={part.text}
                                sources={sources}
                              />
                            );
                          }
                          return (
                            <MessageResponse key={`${message.id}-${i}`}>
                              {part.text}
                            </MessageResponse>
                          );
                        default:
                          if (part.type.startsWith("tool-")) {
                            const toolName = part.type.slice(5);
                            return (
                              <AgentToolCall
                                key={`${message.id}-${i}`}
                                toolName={toolName}
                                part={part}
                              />
                            );
                          }
                          return null;
                      }
                    })}
                  </MessageContent>
                </Message>
                );
              })}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}

        <div className="mx-auto w-full max-w-2xl px-4 [&_[data-slot=input-group]]:rounded-b-none [&_[data-slot=input-group]]:border-b-0">
          <PromptInput onSubmit={handleSubmit} globalDrop multiple>
            <PromptInputAttachmentsDisplay />
            <PromptInputBody>
              <PromptInputTextarea placeholder="Ask anything..." />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <PromptInputButton
                  tooltip={{ content: "Web search is always available" }}
                  variant="ghost"
                  disabled
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
                <PromptInputSelect
                  onValueChange={(value) => setModel(value)}
                  value={model}
                >
                  <PromptInputSelectTrigger>
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {models.map((m) => (
                      <PromptInputSelectItem key={m.id} value={m.id}>
                        {m.name}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </TooltipProvider>
  );
}
