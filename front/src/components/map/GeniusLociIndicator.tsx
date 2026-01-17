import { motion } from 'framer-motion';

interface GeniusLociIndicatorProps {
  intensity: number; // 0-1，周围情绪浓度
  mood?: 'melancholy' | 'warmth' | 'spark' | 'peace' | 'joy';
}

const moodColors = {
  melancholy: '#B0C4DE',
  warmth: '#D8BFD8',
  spark: '#8FBC8F',
  peace: '#DEB887',
  joy: '#F4A460',
};

export function GeniusLociIndicator({ intensity = 0.5, mood = 'peace' }: GeniusLociIndicatorProps) {
  const color = moodColors[mood];
  
  return (
    <motion.div
      className="relative w-12 h-12"
      animate={{
        scale: [1, 1.05 + intensity * 0.1, 1],
      }}
      transition={{
        duration: 3 + (1 - intensity) * 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {/* 外层墨滴光晕 */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}50 0%, ${color}20 50%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* 液态墨滴主体 */}
      <motion.div
        className="absolute inset-1 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${color} 0%, #333 80%)`,
          boxShadow: `0 4px 20px ${color}40`,
        }}
        animate={{
          borderRadius: [
            '60% 40% 30% 70%/60% 30% 70% 40%',
            '30% 60% 70% 40%/50% 60% 30% 60%',
            '60% 40% 30% 70%/60% 30% 70% 40%',
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* 高光点 */}
      <motion.div
        className="absolute w-2 h-2 bg-white/60 rounded-full"
        style={{ top: '20%', left: '25%' }}
        animate={{
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}
