import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, PenLine, MessageCircle, Trash2 } from "lucide-react";
import { api, type Note } from "../api/client";
import type { MoodType } from "../types";

const moodColors: Record<string, string> = {
  melancholy: "#B0C4DE",
  warmth: "#D8BFD8",
  spark: "#8FBC8F",
  peace: "#DEB887",
  joy: "#F4A460",
  calm: "#DEB887",
};

const moodLabels: Record<string, string> = {
  melancholy: "忧郁",
  warmth: "温暖",
  spark: "灵感",
  peace: "平静",
  joy: "喜悦",
  calm: "平静",
};

interface LetterPageProps {
  onBack: () => void;
  onOpenChat: (noteId: number) => void;
}

export function LetterPage({ onBack, onOpenChat }: LetterPageProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRecordPanel, setShowRecordPanel] = useState(false);
  const [recordMode, setRecordMode] = useState<"trace" | "spirit">("trace");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("calm");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 加载笔记
  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    try {
      const data = await api.getNotes();
      setNotes(data);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // 提交笔记
  async function handleSubmit() {
    if (!content.trim()) return;
    setIsSubmitting(true);

    try {
      const note = await api.createNote({
        content: content.trim(),
        mood,
        mode: recordMode,
        isPrivate,
        // 位置信息可以后续添加
      });
      
      setNotes([note, ...notes]);
      setContent("");
      setShowRecordPanel(false);
      
      // 如果是唤灵模式，直接打开聊天
      if (recordMode === "spirit") {
        onOpenChat(note.id);
      }
    } catch (error) {
      console.error("Failed to create note:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  // 删除笔记
  async function handleDelete(noteId: number) {
    try {
      await api.deleteNote(noteId);
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "";
    const d = new Date(timestamp * 1000);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-dvh bg-canvas paper-texture">
      {/* 头部 */}
      <header className="sticky top-0 z-10 glass safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <motion.button
              className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center"
              onClick={onBack}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft className="w-5 h-5 text-ink" />
            </motion.button>
            <div>
              <h1 className="font-display text-xl text-ink">我的记录</h1>
              <p className="text-ink-faint text-xs">留痕与唤灵</p>
            </div>
          </div>
          <motion.button
            className="w-10 h-10 rounded-full bg-gradient-to-br from-mood-melancholy to-mood-warmth flex items-center justify-center"
            onClick={() => setShowRecordPanel(true)}
            whileTap={{ scale: 0.95 }}
          >
            <PenLine className="w-5 h-5 text-white" />
          </motion.button>
        </div>
      </header>

      {/* 笔记列表 */}
      <div className="px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-16">
            <motion.div
              className="w-8 h-8 mx-auto rounded-full bg-gradient-to-br from-mood-spark/30 to-mood-peace/30"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <p className="text-ink-faint font-serif mt-4">正在加载...</p>
          </div>
        ) : notes.length === 0 ? (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <PenLine className="w-12 h-12 mx-auto text-ink-faint/30 mb-4" />
            <p className="text-ink-faint font-serif">还没有记录</p>
            <p className="text-ink-faint/60 text-sm mt-1">
              点击右上角开始记录你的故事
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {notes.map((note, index) => (
              <motion.div
                key={note.id}
                className="p-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-ink/5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* 头部信息 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: moodColors[note.mood || "calm"] }}
                    />
                    <span className="text-ink-faint text-xs">
                      {moodLabels[note.mood || "calm"]}
                    </span>
                    {note.mode === "spirit" && (
                      <span className="px-1.5 py-0.5 text-xs bg-mood-spark/20 text-mood-spark rounded">
                        唤灵
                      </span>
                    )}
                    {note.isPrivate === 1 && (
                      <span className="px-1.5 py-0.5 text-xs bg-ink/10 text-ink-faint rounded">
                        私密
                      </span>
                    )}
                  </div>
                  <span className="text-ink-faint/50 text-xs">
                    {formatDate(note.createdAt)}
                  </span>
                </div>

                {/* 内容 */}
                <p className="text-ink font-serif text-sm leading-relaxed mb-3">
                  {note.content}
                </p>

                {/* AI总结 */}
                {note.aiSummary && (
                  <div className="p-3 rounded-xl bg-parchment/30 border border-ink/5 mb-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-mood-spark to-mood-peace" />
                      <span className="text-xs text-ink-faint">地灵寄语</span>
                    </div>
                    <p className="text-ink/80 text-sm font-serif italic">
                      {note.aiSummary}
                    </p>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 pt-2 border-t border-ink/5">
                  {note.mode === "spirit" && (
                    <motion.button
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-mood-spark/10 text-mood-spark text-xs"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onOpenChat(note.id)}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      继续对话
                    </motion.button>
                  )}
                  <motion.button
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-ink/5 text-ink-faint text-xs ml-auto"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(note.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* 记录面板 */}
      <AnimatePresence>
        {showRecordPanel && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/30 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRecordPanel(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-canvas rounded-t-3xl z-50 safe-area-bottom"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="p-6">
                {/* 把手 */}
                <div className="w-10 h-1 bg-ink/10 rounded-full mx-auto mb-6" />

                {/* 模式切换 */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    className={`flex-1 py-2 rounded-full text-sm font-serif transition-colors ${
                      recordMode === "trace"
                        ? "bg-ink text-canvas"
                        : "bg-ink/5 text-ink"
                    }`}
                    onClick={() => setRecordMode("trace")}
                  >
                    留痕
                  </button>
                  <button
                    className={`flex-1 py-2 rounded-full text-sm font-serif transition-colors ${
                      recordMode === "spirit"
                        ? "bg-gradient-to-r from-mood-spark to-mood-peace text-white"
                        : "bg-ink/5 text-ink"
                    }`}
                    onClick={() => setRecordMode("spirit")}
                  >
                    唤灵
                  </button>
                </div>

                {/* 输入框 */}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    recordMode === "trace"
                      ? "在这里留下你的痕迹..."
                      : "写下心事，唤醒地灵与你对话..."
                  }
                  className="w-full h-32 p-4 bg-white/50 rounded-2xl text-ink font-serif text-sm placeholder:text-ink-faint resize-none focus:outline-none border border-ink/5"
                />

                {/* 情绪选择 */}
                <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
                  {Object.entries(moodLabels).map(([key, label]) => (
                    <button
                      key={key}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                        mood === key
                          ? "bg-ink text-canvas"
                          : "bg-ink/5 text-ink"
                      }`}
                      onClick={() => setMood(key)}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: moodColors[key] }}
                      />
                      <span className="text-xs">{label}</span>
                    </button>
                  ))}
                </div>

                {/* 私密开关 */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink/5">
                  <span className="text-sm text-ink-faint">私密记录</span>
                  <button
                    className={`w-12 h-6 rounded-full transition-colors ${
                      isPrivate ? "bg-mood-warmth" : "bg-ink/10"
                    }`}
                    onClick={() => setIsPrivate(!isPrivate)}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white shadow-sm"
                      animate={{ x: isPrivate ? 26 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* 提交按钮 */}
                <motion.button
                  className="w-full mt-6 py-3 rounded-full bg-gradient-to-r from-mood-melancholy to-mood-warmth text-white font-serif disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={!content.trim() || isSubmitting}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSubmitting
                    ? "正在保存..."
                    : recordMode === "trace"
                    ? "留下痕迹"
                    : "唤醒地灵"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
