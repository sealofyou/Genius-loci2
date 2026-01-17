import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { Memory, MoodType } from '../../types';

const moodColors: Record<MoodType, string> = {
  melancholy: '#B0C4DE',
  warmth: '#D8BFD8',
  spark: '#8FBC8F',
  peace: '#DEB887',
  joy: '#F4A460',
};

const moodLabels: Record<MoodType, string> = {
  melancholy: '忧郁',
  warmth: '温暖',
  spark: '灵感',
  peace: '平静',
  joy: '喜悦',
};

interface ResonanceFieldProps {
  onClose: () => void;
}

interface BubbleData {
  memory: Memory;
  x: number;
  y: number;
  size: number;
  delay: number;
}

export function ResonanceField({ onClose }: ResonanceFieldProps) {
  const { selectedSpot, getMemoriesBySpot, addResonance } = useAppStore();
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [resonated, setResonated] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedSpot) return;
    
    const memories = getMemoriesBySpot(selectedSpot.id);
    const newBubbles = memories.map((memory, index) => ({
      memory,
      x: 15 + Math.random() * 70, // 15%-85% 横向分布
      y: 20 + Math.random() * 50, // 20%-70% 纵向分布
      size: 80 + Math.random() * 60, // 80-140px
      delay: index * 0.3,
    }));
    
    setBubbles(newBubbles);
  }, [selectedSpot, getMemoriesBySpot]);

  const handleResonance = (memoryId: string) => {
    if (resonated.has(memoryId)) return;
    
    addResonance(memoryId);
    setResonated(prev => new Set(prev).add(memoryId));
    
    // 触觉反馈
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    if (hours < 48) return '昨天';
    return `${Math.floor(hours / 24)}天前`;
  };

  if (!selectedSpot) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 背景虚化 */}
      <motion.div
        className="absolute inset-0 bg-canvas/90 backdrop-blur-xl"
        initial={{ backdropFilter: 'blur(0px)' }}
        animate={{ backdropFilter: 'blur(20px)' }}
      />

      {/* 关闭按钮 */}
      <motion.button
        className="absolute top-4 right-4 safe-area-top z-10 w-10 h-10 rounded-full glass flex items-center justify-center"
        onClick={onClose}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <X className="w-5 h-5 text-ink" />
      </motion.button>

      {/* 地灵开场白 */}
      <motion.div
        className="absolute top-20 left-0 right-0 text-center px-6 safe-area-top"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-ink/60 font-serif text-lg">
          这里今晚藏着 <span className="text-ink font-medium">{bubbles.length}</span> 个
          <span style={{ color: moodColors[selectedSpot.mood] }}>
            {moodLabels[selectedSpot.mood]}
          </span>
          的秘密
        </p>
        <p className="text-ink-faint text-sm mt-2">{selectedSpot.location.name}</p>
      </motion.div>

      {/* 漂浮气泡 */}
      <div className="absolute inset-0 overflow-hidden">
        {bubbles.map((bubble, index) => (
          <motion.div
            key={bubble.memory.id}
            className="absolute cursor-pointer"
            style={{
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: 0.8,
              scale: 1,
              y: [0, -15, 0],
            }}
            transition={{
              opacity: { delay: bubble.delay, duration: 0.5 },
              scale: { delay: bubble.delay, duration: 0.5 },
              y: { delay: bubble.delay + 0.5, duration: 6 + index, repeat: Infinity, ease: 'easeInOut' },
            }}
            onClick={() => setSelectedMemory(bubble.memory)}
            whileTap={{ scale: 0.95 }}
          >
            {/* 气泡 */}
            <div
              className="rounded-full relative overflow-hidden"
              style={{
                width: bubble.size,
                height: bubble.size,
                background: `radial-gradient(circle at 30% 30%, ${moodColors[bubble.memory.mood]}60 0%, ${moodColors[bubble.memory.mood]}20 70%, transparent 100%)`,
                boxShadow: `0 0 30px ${moodColors[bubble.memory.mood]}30`,
              }}
            >
              {/* 预览内容 */}
              <div className="absolute inset-4 flex items-center justify-center text-ink/60 text-sm font-serif text-center line-clamp-3 overflow-hidden">
                {bubble.memory.content.slice(0, 30)}...
              </div>
              
              {/* 高光 */}
              <div className="absolute top-2 left-3 w-4 h-4 rounded-full bg-white/30 blur-sm" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* 选中的记录详情 */}
      <AnimatePresence>
        {selectedMemory && (
          <motion.div
            className="absolute inset-x-4 bottom-8 safe-area-bottom z-20"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          >
            <motion.div
              className="bg-canvas/95 backdrop-blur-lg rounded-2xl p-5 shadow-watercolor letter-border"
              layoutId={`memory-${selectedMemory.id}`}
            >
              {/* 关闭详情 */}
              <button
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center"
                onClick={() => setSelectedMemory(null)}
              >
                <X className="w-4 h-4 text-ink-faint" />
              </button>

              {/* 时间和地点 */}
              <div className="flex items-center gap-2 text-ink-faint text-sm mb-3">
                <span>{selectedMemory.location.name}</span>
                <span>·</span>
                <span>{formatTime(selectedMemory.createdAt)}</span>
              </div>

              {/* 图片 */}
              {selectedMemory.imageUrl && (
                <img
                  src={selectedMemory.imageUrl}
                  alt=""
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />
              )}

              {/* 内容 */}
              <p className="text-ink font-serif leading-relaxed mb-4">
                {selectedMemory.content}
              </p>

              {/* 共鸣按钮 */}
              <div className="flex items-center justify-between">
                <span className="text-ink-faint text-sm">
                  {selectedMemory.resonanceCount + (resonated.has(selectedMemory.id) ? 1 : 0)} 次共鸣
                </span>
                
                <motion.button
                  className={`flex items-center gap-2 px-5 py-2 rounded-full font-serif ${
                    resonated.has(selectedMemory.id)
                      ? 'bg-mood-warmth/30 text-ink'
                      : 'bg-ink/10 text-ink'
                  }`}
                  onClick={() => handleResonance(selectedMemory.id)}
                  disabled={resonated.has(selectedMemory.id)}
                  whileTap={{ scale: 0.95 }}
                >
                  <Heart
                    className={`w-4 h-4 ${resonated.has(selectedMemory.id) ? 'fill-mood-warmth' : ''}`}
                  />
                  {resonated.has(selectedMemory.id) ? '已共鸣' : '共鸣'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
