"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SpiderSenseChatProps {
  /** Optional question to auto-open and ask on mount (e.g. /ask?q=…). */
  initialQuestion?: string;
}

const suggestedQueries = [
  "When did anime explode?",
  "What's the rarest item?",
  "Should I buy now or wait?",
];

/** Floating SENSE chat widget that talks to /api/ask. */
export default function SpiderSenseChat({
  initialQuestion,
}: SpiderSenseChatProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isOpen, setIsOpen] = useState(Boolean(initialQuestion));

  useEffect(() => {
    if (initialQuestion) {
      setIsOpen(true);
      void sendText(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    setIsThinking(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, category: "general" }),
      });
      const data = await response.json();
      const content =
        data.answer ?? data.error ?? "The Oracle is silent… try again.";
      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleAsk() {
    void sendText(input);
  }

  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        onClick={() => setIsOpen(true)}
        aria-label="Open SENSE chat"
        className="fixed bottom-8 right-8 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-3xl shadow-lg"
      >
        <span aria-hidden>🕸️</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-8 right-8 z-50 flex h-[600px] w-96 flex-col rounded-lg border-2 border-red-600 bg-gray-900 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-lg bg-red-600 p-4">
        <div>
          <h3 className="text-xl font-bold text-white">SENSE</h3>
          <p className="text-xs text-red-200">
            {isThinking ? "Analyzing dimensions…" : "Ready"}
          </p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Close chat"
          className="text-white hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-red-600 bg-gray-800 text-gray-100"
                }`}
              >
                {msg.role === "assistant" && (
                  <span className="mr-2 text-2xl" aria-hidden>
                    🕸️
                  </span>
                )}
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="rounded-lg border border-red-600 bg-gray-800 p-3">
              <span className="mr-2 text-2xl" aria-hidden>
                🕸️
              </span>
              <span className="text-gray-400">Thinking…</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Suggested Queries */}
      {messages.length === 0 && (
        <div className="border-t border-gray-800 p-4">
          <p className="mb-2 text-xs text-gray-400">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQueries.map((query, i) => (
              <button
                key={i}
                onClick={() => setInput(query)}
                className="rounded-full border border-red-600 bg-gray-800 px-3 py-1 text-xs text-gray-300 hover:bg-gray-700"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask about any dimension…"
            className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-red-600 focus:outline-none"
          />
          <button
            onClick={handleAsk}
            disabled={isThinking}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>
    </motion.div>
  );
}
