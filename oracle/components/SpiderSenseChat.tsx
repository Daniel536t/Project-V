"use client";

import { useEffect, useState, type FormEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SpiderSenseChatProps {
  /** Optional question to auto-send on mount (e.g. from the landing search bar). */
  initialQuestion?: string;
}

/** AI chat widget that talks to /api/ask. */
export default function SpiderSenseChat({
  initialQuestion,
}: SpiderSenseChatProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialQuestion) void sendText(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  async function sendText(text: string) {
    if (!text.trim() || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text.trim() }),
      });
      const data = await res.json();
      const answer =
        data.answer ?? data.error ?? "The Oracle is silent… try again.";
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Failed to reach the Oracle." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await sendText(input);
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-spider-blue/30 bg-panel/80 p-4 backdrop-blur">
      <p className="font-display text-lg tracking-wider text-spider-blue">
        SPIDER-SENSE CHAT
      </p>

      <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-foreground/40">
            Ask a question and the Oracle answers across dimensions…
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${
              m.role === "user"
                ? "self-end bg-spider-red/90 text-white"
                : "self-start bg-panel text-foreground/90"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="self-start text-sm text-spider-blue">…</div>
        )}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Oracle…"
          aria-label="Chat message"
          className="flex-1 rounded-xl border border-foreground/20 bg-ink px-4 py-2 text-sm text-foreground outline-none focus:border-spider-red"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-spider-red px-4 py-2 font-display tracking-wider text-white transition hover:bg-spider-pink disabled:opacity-50"
        >
          SEND
        </button>
      </form>
    </div>
  );
}
