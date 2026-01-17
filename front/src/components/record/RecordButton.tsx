import { motion } from 'framer-motion';
import { useLongPress, useHaptic } from '../../hooks';

interface RecordButtonProps {
  onTap: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}

export function RecordButton({ onTap, onLongPress, disabled }: RecordButtonProps) {
  const { trigger } = useHaptic();
  
  const longPressHandlers = useLongPress(
    () => {
      trigger('medium');
      onLongPress();
    },
    () => {
      trigger('light');
      onTap();
    },
    { threshold: 500, vibrate: false }
  );

  return (
    <motion.button
      className="relative w-16 h-16 rounded-full bg-ink/90 shadow-ink fingerprint-btn disabled:opacity-50"
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      {...longPressHandlers}
    >
      {/* 外环 - 指纹纹理暗示 */}
      <div className="absolute inset-0 rounded-full border-2 border-ink/20" />
      
      {/* 内部光晕 */}
      <motion.div
        className="absolute inset-2 rounded-full bg-gradient-to-br from-ink-light/20 to-transparent"
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* 中心点 */}
      <motion.div
        className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas/80"
        animate={{
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* 长按提示环 */}
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r="30"
          fill="none"
          stroke="rgba(250, 250, 245, 0.1)"
          strokeWidth="2"
          strokeDasharray="188.5"
          strokeDashoffset="0"
        />
      </svg>
    </motion.button>
  );
}
