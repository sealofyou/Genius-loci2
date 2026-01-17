import { motion, AnimatePresence } from 'framer-motion';
import type { MoodType } from '../../types';

const moodColors: Record<MoodType, string> = {
  melancholy: '#B0C4DE',
  warmth: '#D8BFD8',
  spark: '#8FBC8F',
  peace: '#DEB887',
  joy: '#F4A460',
};

interface MoodSpotProps {
  id: string;
  mood: MoodType;
  intensity: number;
  memoriesCount: number;
  position: { x: number; y: number };
  onClick: () => void;
  isSelected: boolean;
}

export function MoodSpot({
  mood,
  intensity,
  memoriesCount,
  position,
  onClick,
  isSelected,
}: MoodSpotProps) {
  const color = moodColors[mood];
  const size = 60 + intensity * 40; // 60-100px

  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
    >
      {/* 外层光晕 - 呼吸动画 */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 1.6,
          height: size * 1.6,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${color}40 0%, ${color}10 50%, transparent 70%)`,
          filter: 'blur(10px)',
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* 主体水彩晕染 */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 30%, ${color}80 0%, ${color}50 40%, ${color}20 70%, transparent 100%)`,
          boxShadow: `0 0 ${size / 2}px ${color}40`,
          filter: 'blur(2px)',
        }}
        animate={isSelected ? { scale: 1.2 } : { scale: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* 数量指示器 */}
      <AnimatePresence>
        {memoriesCount > 0 && (
          <motion.div
            className="absolute -top-1 -right-1 bg-ink/80 text-canvas text-xs px-2 py-0.5 rounded-full font-serif"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
          >
            {memoriesCount}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// 水彩滤镜 SVG
export function WatercolorFilter() {
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        <filter id="watercolor-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="3"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="10"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>
    </svg>
  );
}
