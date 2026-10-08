"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Send,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";

interface SourceItem {
  source_type: string;
  identifier: string;
  title: string;
  details?: string | null;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  confidence?: number | null;
  sources?: SourceItem[];
  warnings?: string[];
}

interface HistoryResponseItem {
  query_id: string;
  question: string;
  answer: string;
  confidence_score: number | null;
  timestamp: string;
  sources: SourceItem[];
}

interface QueryResponse {
  query_id: string;
  question: string;
  answer: string;
  confidence_score: number;
  timestamp: string;
  sources: SourceItem[];
  scoped_properties_count: number;
  warnings: string[];
}

const QUICK_PROMPTS = [
  "What is the registered value of my property?",
  "Are there active encumbrances or mortgages?",
  "What is my title deed number?",
  "Show my latest recorded transaction details",
  "What documents are registered under my property?"
];

export function UserNLPAssistantModal() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageIdCounter = useRef(0);

  // Available for authenticated users (including PUBLIC users)
  const isEligible = Boolean(user);

  useEffect(() => {
    if (!isOpen || !isEligible) return;

    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const { data } = await api.get<HistoryResponseItem[]>(
          "/api/v1/user-assistant/history",
          { params: { limit: 30 } }
        );
        if (cancelled) return;

        // Map API history (latest first) to chronological conversation order
        const loaded: MessageItem[] = [];
        const reversed = [...data].reverse();
        for (const item of reversed) {
          loaded.push({
            id: `${item.query_id}-q`,
            role: "user",
            content: item.question,
            timestamp: item.timestamp
          });
          loaded.push({
            id: `${item.query_id}-a`,
            role: "assistant",
            content: item.answer,
            timestamp: item.timestamp,
            confidence: item.confidence_score,
            sources: item.sources
          });
        }
        setMessages(loaded);
      } catch (err) {
        if (!cancelled) {
          // Soft failure on history fetch
          console.warn("Unable to load assistant history:", err);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isEligible]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isEligible) {
    return null;
  }

  async function handleSend(textToSend?: string) {
    const question = (textToSend ?? inputQuestion).trim();
    if (!question || isLoading) return;

    setInputQuestion("");

    messageIdCounter.current += 1;
    const tempId = `msg-${messageIdCounter.current}`;
    const userMsg: MessageItem = {
      id: tempId,
      role: "user",
      content: question,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data } = await api.post<QueryResponse>(
        "/api/v1/user-assistant/query",
        { question }
      );

      const assistantMsg: MessageItem = {
        id: data.query_id,
        role: "assistant",
        content: data.answer,
        timestamp: data.timestamp,
        confidence: data.confidence_score,
        sources: data.sources,
        warnings: data.warnings
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Unable to process your query right now.";
      messageIdCounter.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${messageIdCounter.current}`,
          role: "assistant",
          content: `⚠️ Error: ${detail}`,
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClearHistory() {
    if (
      !confirm(
        "Clear all saved NLP assistant conversation history from your account?"
      )
    ) {
      return;
    }
    try {
      await api.delete("/api/v1/user-assistant/history");
      setMessages([]);
    } catch (err) {
      console.warn("Failed to clear history:", err);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <>
      {/* Round Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-text-inverse shadow-xl transition-all duration-300 hover:scale-105 hover:bg-primary-hover hover:shadow-2xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-primary/20"
          aria-label="Open AI Property Assistant"
          title="AI Property Assistant (Natural Language Query)"
        >
          {isOpen ? (
            <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
          ) : (
            <>
              <Sparkles className="h-6 w-6 transition-transform group-hover:scale-110" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Pop Modal / Floating Assistant Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className={`fixed right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl backdrop-blur-sm transition-all duration-200 ${
              isExpanded
                ? "bottom-6 left-6 top-6 sm:bottom-6 sm:left-auto sm:right-6 sm:top-auto sm:h-[720px] sm:w-[600px]"
                : "bottom-24 h-[580px] w-[calc(100vw-3rem)] max-w-[440px]"
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-text-primary">
                      AI Property Assistant
                    </h3>
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      NLP Active
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Scoped strictly to your properties &amp; transactions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    title="Clear Chat History"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  title={isExpanded ? "Collapse" : "Expand"}
                  className="hidden h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text-primary sm:flex"
                >
                  {isExpanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Close Assistant"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Privacy & Scope Notice Bar */}
            <div className="flex items-center gap-2 border-b border-border/50 bg-primary/5 px-4 py-2 text-[11px] text-text-secondary">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">
                Protected: Queries outside your owned/shared records are
                restricted.
              </span>
            </div>

            {/* Chat Body */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto p-4 text-xs leading-relaxed"
            >
              {historyLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Loading conversation history…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-text-primary">
                      Ask anything about your properties
                    </p>
                    <p className="text-text-muted text-[11px] max-w-[280px]">
                      Ask questions about valuation, title deeds, encumbrances,
                      transactions, or documents in natural language.
                    </p>
                  </div>

                  <div className="w-full space-y-1.5 pt-2 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Suggested Questions:
                    </p>
                    {QUICK_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => void handleSend(prompt)}
                        className="w-full rounded-lg border border-border/70 bg-surface-subtle p-2 text-left text-[11px] text-text-primary transition-colors hover:border-primary/50 hover:bg-surface"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                        msg.role === "user"
                          ? "bg-primary text-text-inverse rounded-tr-none"
                          : "bg-surface-subtle border border-border text-text-primary rounded-tl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Assistant Sources / Evidence Tags */}
                      {msg.role === "assistant" &&
                        msg.sources &&
                        msg.sources.length > 0 && (
                          <div className="mt-2.5 space-y-1 border-t border-border/40 pt-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                              Referenced Records:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {msg.sources.map((s, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-secondary border border-border/50"
                                >
                                  <FileText className="h-2.5 w-2.5 text-primary" />
                                  {s.title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                    <span className="mt-1 px-1 text-[9px] text-text-muted">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none border border-border bg-surface-subtle p-3 text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Analyzing property records with NLP…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="border-t border-border bg-surface p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  ref={inputRef}
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your property, documents, or transactions…"
                  rows={2}
                  disabled={isLoading}
                  className="flex-1 resize-none rounded-xl border border-border bg-surface-canvas p-2.5 text-xs text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputQuestion.trim() || isLoading}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-text-inverse transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                  title="Send Question"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-text-muted">
                <span>Enter to send · Shift+Enter for newline</span>
                <span>History automatically saved</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
