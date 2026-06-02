import { Mic, Paperclip, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface CopilotMessage {
  content: string;
  role: "user" | "assistant";
}

interface CopilotProps {
  className?: string;
  greeting?: string;
  /** Wire to your backend LLM. Receives full history, returns the reply text. */
  onSendMessage?: (history: CopilotMessage[]) => Promise<string>;
  suggestions?: string[];
}

const DEFAULT_GREETING =
  "Morning. Portfolio RevPAR is $142.80, up 8.2% on the prior 30 days. Compression around the Tech Summit (Jun 4–8) is running high — want me to draft rate moves?";

const DEFAULT_SUGGESTIONS = [
  "Why is RevPAR up?",
  "Draft a rate plan for Jun 4–8",
  "Top 3 opportunities",
  "Summarize compression",
];

function MarkdownLite({ text }: { text: string }) {
  // bold + line breaks only — safe, no dangerouslySetInnerHTML
  return (
    <>
      {text.split("\n").map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable line order
        <span className="block" key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable token order
              <strong key={j}>{part.slice(2, -2)}</strong>
            ) : (
              part
            )
          )}
        </span>
      ))}
    </>
  );
}

export function Copilot({
  onSendMessage,
  greeting = DEFAULT_GREETING,
  suggestions = DEFAULT_SUGGESTIONS,
  className,
}: CopilotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    { role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed && files.length === 0) {
        return;
      }
      const userMsg: CopilotMessage = {
        role: "user",
        content:
          trimmed + (files.length ? `\n\n[Attached: ${files.join(", ")}]` : ""),
      };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput("");
      setFiles([]);
      setSending(true);
      try {
        const reply = onSendMessage
          ? await onSendMessage(next)
          : "I'd analyze that across the portfolio and reply with specifics — wire `onSendMessage` to your model to make this live.";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } finally {
        setSending(false);
      }
    },
    [files, messages, onSendMessage]
  );

  const toggleVoice = () => {
    const SR =
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognition;
        }
      ).webkitSpeechRecognition ??
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition })
        .SpeechRecognition;
    if (!SR) {
      return;
    }
    if (recording) {
      setRecording(false);
      return;
    }
    const recog = new SR();
    recog.lang = "en-US";
    recog.interimResults = true;
    recog.onresult = (ev: SpeechRecognitionEvent) => {
      let t = "";
      for (let i = 0; i < ev.results.length; i++) {
        t += ev.results[i][0].transcript;
      }
      setInput(t);
    };
    recog.onend = () => setRecording(false);
    recog.start();
    setRecording(true);
  };

  return (
    <>
      {!open && (
        <button
          className="fixed right-6 bottom-6 z-40 inline-flex items-center gap-2.5 rounded-full bg-primary py-3.5 pr-5 pl-3.5 font-bold text-primary-foreground text-sm shadow-[0_16px_38px_-12px_var(--primary)] transition-transform hover:-translate-y-0.5"
          onClick={() => setOpen(true)}
          type="button"
        >
          <span className="flex size-[30px] items-center justify-center rounded-full bg-white/20">
            <Sparkles className="size-4" />
          </span>
          Ask Copilot
          <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">
            ⌘J
          </span>
        </button>
      )}

      {open && (
        <div
          className={cn(
            "fixed right-6 bottom-6 z-50 flex h-[560px] w-[384px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-input bg-card shadow-[0_44px_100px_-28px_rgb(0_0_0/0.6)]",
            className
          )}
          data-slot="copilot"
        >
          <div className="flex items-center gap-2.5 border-border border-b bg-card p-3.5">
            <span className="flex size-[34px] items-center justify-center rounded-md bg-[linear-gradient(140deg,var(--primary),var(--ember-600))]">
              <Sparkles className="size-4 text-white" />
            </span>
            <span className="flex-1 leading-tight">
              <span className="block font-display font-semibold text-[14.5px]">
                RevPARMAX Copilot
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-mid before:size-1.5 before:rounded-full before:bg-pos">
                Online · Portfolio · 12 properties
              </span>
            </span>
            <button
              aria-label="Close"
              className="flex size-[30px] items-center justify-center rounded-md text-mid hover:bg-bar hover:text-foreground"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>

          <div
            className="flex flex-1 flex-col gap-3 overflow-y-auto bg-background p-4"
            ref={bodyRef}
          >
            {messages.map((m, i) => (
              <div
                className={cn(
                  "flex max-w-[90%] gap-2.5",
                  m.role === "user" ? "flex-row-reverse self-end" : "self-start"
                )}
                // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
                key={i}
              >
                <div
                  className={cn(
                    "rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-relaxed",
                    m.role === "user"
                      ? "rounded-tr-[5px] bg-primary text-primary-foreground"
                      : "rounded-tl-[5px] border border-border bg-card text-foreground"
                  )}
                >
                  <MarkdownLite text={m.content} />
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-1 self-start rounded-[14px] border border-border bg-card px-3.5 py-3">
                {[0, 1, 2].map((d) => (
                  <span
                    className="size-1.5 animate-bounce rounded-full bg-low"
                    key={d}
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-border border-t bg-card p-3">
            {messages.length <= 1 && (
              <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-1">
                {suggestions.map((s) => (
                  <button
                    className="shrink-0 whitespace-nowrap rounded-full border border-input bg-card px-2.5 py-1.5 text-[12px] text-mid transition-colors hover:border-primary/30 hover:bg-accent hover:text-acc-deep"
                    key={s}
                    onClick={() => send(s)}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {files.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {files.map((f) => (
                  <span
                    className="inline-flex items-center gap-2 rounded-md bg-bar py-1 pr-1.5 pl-2.5 font-mono text-[11px]"
                    key={f}
                  >
                    {f}
                    <button
                      aria-label={`Remove ${f}`}
                      className="text-low hover:text-foreground"
                      onClick={() => setFiles((p) => p.filter((x) => x !== f))}
                      type="button"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-1.5 rounded-md border border-input bg-secondary py-1.5 pr-1.5 pl-3.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
              <textarea
                className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-[13.5px] text-foreground outline-none placeholder:text-low"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={
                  recording
                    ? "Listening…"
                    : "Ask about rates, pace, compression…"
                }
                rows={1}
                value={input}
              />
              <input
                className="hidden"
                multiple
                onChange={(e) => {
                  const names = Array.from(e.target.files ?? []).map(
                    (f) => f.name
                  );
                  setFiles((p) => [...p, ...names]);
                  e.target.value = "";
                }}
                ref={fileRef}
                type="file"
              />
              <button
                aria-label="Attach files"
                className="flex size-[34px] items-center justify-center rounded-md text-mid hover:bg-bar hover:text-foreground"
                onClick={() => fileRef.current?.click()}
                type="button"
              >
                <Paperclip className="size-4" />
              </button>
              <button
                aria-label="Voice input"
                className={cn(
                  "flex size-[34px] items-center justify-center rounded-md text-mid hover:bg-bar hover:text-foreground",
                  recording && "bg-neg/14 text-neg"
                )}
                onClick={toggleVoice}
                type="button"
              >
                <Mic className="size-4" />
              </button>
              <button
                aria-label="Send"
                className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform hover:-translate-y-px disabled:opacity-40"
                disabled={sending}
                onClick={() => send(input)}
                type="button"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
