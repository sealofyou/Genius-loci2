import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send } from "lucide-react";
import { client, api, type Note, type Chat } from "../api/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPageProps {
  noteId: number;
  onBack: () => void;
}

export function ChatPage({ noteId, onBack }: ChatPageProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载笔记和历史聊天
  useEffect(() => {
    async function loadData() {
      try {
        const res = await client.api.fetch(`/api/notes/${noteId}`);
        const data = await res.json();
        setNote(data.data);

        const chats = await api.getNoteChats(noteId);
        setMessages(
          chats.map((chat, index) => ({
            id: `history-${index}`,
            role: chat.role as "user" | "assistant",
            content: chat.content,
          }))
        );
      } catch (error) {
        console.error("Failed to load chat data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [noteId]);

  // 发送消息
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await client.api.fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          noteId,
          noteContent: note?.content,
          locationName: note?.locationName,
        }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = `assistant-${Date.now()}`;

      // 添加空的助手消息
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantContent } : m
          )
        );
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  }

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-canvas paper-texture">
        <motion.div
          className="flex flex-col items-center gap-4"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-mood-spark/30 to-mood-peace/30 blur-lg" />
          <p className="text-ink-faint font-serif text-sm">正在连接地灵...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full flex flex-col bg-canvas paper-texture">
      {/* 顶部栏 */}
      <header className="flex items-center gap-4 px-4 pt-4 pb-3 safe-area-top border-b border-ink/5">
        <motion.button
          className="p-2 -ml-2 rounded-full text-ink"
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div className="flex-1">
          <h1 className="font-display text-lg text-ink">唤灵对话</h1>
          {note?.locationName && (
            <p className="text-ink-faint text-xs">{note.locationName}</p>
          )}
        </div>
      </header>

      {/* 笔记内容卡片 */}
      {note && (
        <div className="px-4 py-3">
          <motion.div
            className="p-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-ink/5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-ink text-sm font-serif leading-relaxed line-clamp-3">
              {note.content}
            </p>
          </motion.div>
        </div>
      )}

      {/* 聊天消息区 */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl ${
                  message.role === "user"
                    ? "bg-gradient-to-br from-mood-melancholy/20 to-mood-warmth/20 text-ink"
                    : "bg-white/60 backdrop-blur-sm border border-ink/5 text-ink"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-mood-spark to-mood-peace" />
                    <span className="text-xs text-ink-faint font-serif">地灵</span>
                  </div>
                )}
                <p className="text-sm font-serif leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 加载指示器 */}
        {isSending && messages[messages.length - 1]?.role === "user" && (
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-2xl border border-ink/5">
              <motion.div
                className="w-2 h-2 rounded-full bg-mood-spark"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-xs text-ink-faint">地灵正在回应...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="px-4 pb-4 safe-area-bottom">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 p-2 bg-white/60 backdrop-blur-sm rounded-2xl border border-ink/10"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="与地灵对话..."
            rows={1}
            className="flex-1 px-3 py-2 bg-transparent text-sm font-serif text-ink placeholder:text-ink-faint resize-none focus:outline-none"
            style={{ maxHeight: 120 }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || isSending}
            className="p-2.5 rounded-full bg-gradient-to-br from-mood-melancholy to-mood-warmth text-white disabled:opacity-50 disabled:cursor-not-allowed"
            whileTap={{ scale: 0.95 }}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
