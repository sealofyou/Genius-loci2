import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, MessageCircle, ChevronDown } from "lucide-react";
import { api, type Note, type Emotion } from "../api/client";

interface TracesPageProps {
  onBack: () => void;
}

// 情绪颜色映射
const emotionColors: Record<Emotion, string> = {
  sad: '#8BA4C7',       // 淡蓝灰 - 忧伤
  happy: '#F4C542',     // 暖黄 - 快乐
  calm: '#A8D5BA',      // 淡绿 - 平静
  mysterious: '#B695C0', // 淡紫 - 神秘
  angry: '#E07A5F',     // 暖红 - 愤怒
};

// 情绪中文标签映射
const emotionLabels: Record<Emotion, string> = {
  sad: '忧伤',
  happy: '快乐',
  calm: '平静',
  mysterious: '神秘',
  angry: '愤怒',
};

// 情绪图标映射
const emotionIcons: Record<Emotion, string> = {
  sad: '💧',
  happy: '✨',
  calm: '🌿',
  mysterious: '🌙',
  angry: '🔥',
};

export function TracesPage({ onBack }: TracesPageProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // 加载所有笔记
  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    try {
      const data = await api.getNotes();
      console.log("[TracesPage] Loaded notes:", data);
      setNotes(data);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setIsLoading(false);
    }
  }

  // 格式化日期为中文
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "";
    const d = new Date(timestamp * 1000);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
  };

  // 切换展开/收起
  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 判断是否与地灵聊过（mode为awaken且有aiSummary）
  const hasSpiritReply = (note: Note) => {
    return note.mode === "awaken" && note.aiSummary;
  };

  // 获取情绪颜色
  const getEmotionColor = (emotion: Emotion | null): string => {
    return emotionColors[emotion || 'calm'] || emotionColors.calm;
  };

  // 获取情绪标签
  const getEmotionLabel = (emotion: Emotion | null): string => {
    return emotionLabels[emotion || 'calm'] || emotionLabels.calm;
  };

  // 获取情绪图标
  const getEmotionIcon = (emotion: Emotion | null): string => {
    return emotionIcons[emotion || 'calm'] || emotionIcons.calm;
  };

  return (
    <div className="h-dvh overflow-y-auto bg-canvas paper-texture">
      {/* 头部 */}
      <header className="sticky top-0 z-10 glass safe-area-top">
        <div className="flex items-center gap-4 px-4 py-3">
          <motion.button
            className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center"
            onClick={onBack}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="w-5 h-5 text-ink" />
          </motion.button>
          <div>
            <h1 className="font-display text-xl text-ink">我的想法</h1>
            <p className="text-ink-faint text-xs">所有记录的内容</p>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <div className="px-4 py-6 space-y-4 pb-24">
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-ink/5 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-ink-faint/30" />
            </div>
            <p className="text-ink-faint font-serif">还没有记录</p>
            <p className="text-ink-faint/60 text-sm mt-1">
              点击底部的记录按钮开始记录
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {notes.map((note, index) => {
              const isExpanded = expandedIds.has(note.id);
              const hasSpirit = hasSpiritReply(note);
              const emotionColor = getEmotionColor(note.emotion);

              return (
                <motion.div
                  key={note.id}
                  className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-sm shadow-sm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="p-4">
                    {/* 日期和情绪标签 */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-ink-faint text-xs tracking-wide">
                        {formatDate(note.createdAt)}
                      </p>
                      {/* 情绪标签：颜色图标 + 中文 */}
                      <div 
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        style={{ 
                          backgroundColor: `${emotionColor}20`,
                          color: emotionColor 
                        }}
                      >
                        <span>{getEmotionIcon(note.emotion)}</span>
                        <span className="font-medium">{getEmotionLabel(note.emotion)}</span>
                      </div>
                    </div>

                    {/* 图片（如果有） */}
                    {note.imageUrl && (
                      <div className="mb-3 rounded-xl overflow-hidden">
                        <img 
                          src={note.imageUrl} 
                          alt="" 
                          className="w-full h-40 object-cover"
                        />
                      </div>
                    )}

                    {/* 内容文字 */}
                    <p className="text-ink font-serif leading-relaxed text-base mb-3">
                      {note.content}
                    </p>

                    {/* 与地灵聊过的标记 */}
                    {hasSpirit && (
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-mood-warmth">📍</span>
                        <span className="text-xs text-mood-warmth/80 tracking-wider">
                          已唤灵
                        </span>
                      </div>
                    )}

                    {/* AI寄语区域 - 只有与地灵聊过才显示 */}
                    {hasSpirit && (
                      <>
                        {/* 虚线分隔 */}
                        <div className="border-t border-dashed border-ink/10 my-3" />

                        {/* 可点击展开/收起的区域 */}
                        <motion.button
                          className="w-full text-left"
                          onClick={() => toggleExpand(note.id)}
                        >
                          <AnimatePresence mode="wait">
                            {isExpanded ? (
                              <motion.div
                                key="expanded"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                {/* 标题 */}
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-ink-faint tracking-wider">
                                    地灵寄语
                                  </p>
                                  <ChevronDown className="w-4 h-4 text-ink-faint rotate-180 transition-transform" />
                                </div>
                                {/* AI寄语内容 */}
                                <p className="text-ink/80 font-serif text-sm leading-relaxed italic">
                                  {note.aiSummary}
                                </p>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="collapsed"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center justify-between"
                              >
                                <p className="text-ink-faint/50 text-xs">
                                  点击查看地灵寄语
                                </p>
                                <ChevronDown className="w-4 h-4 text-ink-faint/50" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
