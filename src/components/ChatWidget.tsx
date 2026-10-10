"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { usePathname } from "next/navigation";

export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ from: "bot" | "user"; text: string }[]>([
    { from: "bot", text: "Здравствуйте! Я могу ответить на вопросы о процедурах, записи и работе пространства. Что вас интересует?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;

    setMessages((prev) => [...prev, { from: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.reply !== "string") throw new Error(data.error || "Ошибка связи");
      setMessages((prev) => [...prev, { from: "bot", text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { from: "bot", text: "Ошибка связи. Попробуйте позже." }]);
    }

    sendingRef.current = false;
    setLoading(false);
  };

  if (pathname.startsWith("/shop/cart") || pathname.startsWith("/payment") || pathname.startsWith("/account")) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Открыть чат"
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-50 w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div role="region" aria-label="Чат с пространством" className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-50 w-[calc(100%-1.5rem)] sm:right-6 sm:w-96 h-[500px] max-h-[calc(100dvh-6rem)] bg-[var(--surface-elevated)] text-[var(--foreground)] rounded-3xl shadow-2xl border border-[var(--glass-border)] flex flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between px-5 py-3 border-b border-[var(--glass-border)] bg-[var(--primary)] text-white">
            <span className="font-semibold text-sm">Чат с пространством</span>
            <button type="button" aria-label="Закрыть чат" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
          </div>

          <div role="log" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  m.from === "user"
                    ? "bg-[var(--primary)] text-white rounded-br-md break-words"
                    : "bg-[var(--input-bg)] text-[var(--foreground)] rounded-bl-md break-words"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-[#6B7280]">
                  Печатает...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex shrink-0 items-center gap-2 px-4 py-3 border-t border-[var(--glass-border)]"
          >
            <input
              type="text"
              placeholder="Ваш вопрос..."
              aria-label="Ваш вопрос"
              maxLength={1000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-w-0 flex-1 h-11 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button type="submit" aria-label="Отправить сообщение" disabled={loading || !input.trim()} className="shrink-0 w-11 h-11 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center hover:opacity-90 transition-colors disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
