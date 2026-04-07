import { useEffect, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const API_URL = `${API_BASE_URL}/webhook`;

const formatTime = (date = new Date()) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

function ChatBox() {
  const createSessionId = () => `session-${Math.random().toString(36).slice(2, 10)}`;
  const initialBotMessage = {
    id: "welcome",
    role: "bot",
    text: "Hi! I am your support assistant. Tell me what happened with your order, and I will help immediately.",
    timestamp: formatTime(),
  };
  const [messages, setMessages] = useState([
    initialBotMessage,
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(createSessionId);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp: formatTime(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      const botMessage = {
        id: `bot-${Date.now()}`,
        role: "bot",
        text: data.reply,
        timestamp: formatTime(),
        meta: {
          intent: data.intent,
          confidence: data.confidence,
        },
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (_error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "bot",
          text: "I am having trouble connecting right now. I can connect you to a human support agent if needed.",
          timestamp: formatTime(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([
      {
        ...initialBotMessage,
        id: `welcome-${Date.now()}`,
      },
    ]);
    setInput("");
    setIsLoading(false);
    setSessionId(createSessionId());
  };

  return (
    <section className="flex h-[80vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <header className="border-b border-slate-200 bg-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Food Delivery Support</h1>
            <p className="text-xs text-indigo-100">Live AI assistance</p>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30"
          >
            New Chat
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow ${
                message.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-800"
              }`}
            >
              <p>{message.text}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-70">
                <span>{message.timestamp}</span>
                {message.meta?.intent ? (
                  <span>
                    {message.meta.intent} | {Math.round(message.meta.confidence * 100)}%
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-2 text-sm text-slate-600 shadow">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
              </div>
            </div>
          </div>
        ) : null}

        <div ref={chatEndRef} />
      </div>

      <footer className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your issue..."
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none ring-indigo-200 focus:ring"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={isLoading}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Send
          </button>
        </div>
      </footer>
    </section>
  );
}

export default ChatBox;
