import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Send, Lock, Volume2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { MoodType, PrivacyLevel } from '../../types';

interface RecordPanelProps {
  mode: 'photo' | 'text';
  onClose: () => void;
}

const moods: { type: MoodType; label: string; color: string }[] = [
  { type: 'melancholy', label: '忧郁', color: '#B0C4DE' },
  { type: 'warmth', label: '温暖', color: '#D8BFD8' },
  { type: 'spark', label: '灵感', color: '#8FBC8F' },
  { type: 'peace', label: '平静', color: '#DEB887' },
  { type: 'joy', label: '喜悦', color: '#F4A460' },
];

export function RecordPanel({ mode, onClose }: RecordPanelProps) {
  const [text, setText] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodType>('peace');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('mark');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { addMemory, currentLocation, stopRecording } = useAppStore();

  // 启动相机
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      console.log('无法访问相机');
    }
  };

  // 拍照
  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
    }
    
    // 停止相机流
    streamRef.current?.getTracks().forEach(track => track.stop());
  };

  // 发送记录
  const handleSend = async () => {
    if (!text.trim() && !capturedImage) return;
    if (!currentLocation) return;
    
    setIsSending(true);
    
    // 模拟发送动画
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    addMemory({
      content: text,
      imageUrl: capturedImage || undefined,
      location: currentLocation,
      mood: selectedMood,
      privacy,
    });
    
    stopRecording();
    onClose();
  };

  // 组件挂载时启动相机（仅拍照模式）
  useState(() => {
    if (mode === 'photo') {
      startCamera();
    }
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  });

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-canvas"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* 背景 - 雾气效果 */}
        <div className={`absolute inset-0 ${mode === 'text' ? 'mist' : ''}`}>
          {mode === 'photo' && !capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
          
          {capturedImage && (
            <motion.img
              src={capturedImage}
              alt="captured"
              className="w-full h-full object-cover"
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
            />
          )}
        </div>

        {/* 关闭按钮 */}
        <motion.button
          className="absolute top-4 left-4 safe-area-top w-10 h-10 rounded-full glass flex items-center justify-center"
          onClick={onClose}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-5 h-5 text-ink" />
        </motion.button>

        {/* 拍照按钮 */}
        {mode === 'photo' && !capturedImage && (
          <motion.button
            className="absolute bottom-32 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-4 border-canvas/80 bg-transparent"
            onClick={capturePhoto}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-canvas/90" />
          </motion.button>
        )}

        {/* 底部输入区域 */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 glass safe-area-bottom"
          initial={{ y: '100%' }}
          animate={{ y: (mode === 'text' || capturedImage) ? 0 : '100%' }}
          transition={{ type: 'spring', damping: 25 }}
        >
          <div className="p-4 space-y-4">
            {/* 情绪选择 */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <span className="text-ink-faint text-sm shrink-0">此刻的心情</span>
              {moods.map((m) => (
                <motion.button
                  key={m.type}
                  className={`px-3 py-1 rounded-full text-sm shrink-0 transition-all ${
                    selectedMood === m.type
                      ? 'text-ink font-medium'
                      : 'text-ink-faint'
                  }`}
                  style={{
                    backgroundColor: selectedMood === m.type ? `${m.color}40` : 'transparent',
                    borderColor: m.color,
                    borderWidth: 1,
                  }}
                  onClick={() => setSelectedMood(m.type)}
                  whileTap={{ scale: 0.95 }}
                >
                  {m.label}
                </motion.button>
              ))}
            </div>

            {/* 文字输入 */}
            <textarea
              className="w-full h-24 p-3 bg-transparent border border-ink/10 rounded-lg text-ink font-serif placeholder:text-ink-faint/50 resize-none focus:outline-none focus:border-ink/30"
              placeholder={mode === 'photo' ? '此刻，这里的风在低语什么？' : '写下你的心事...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
            />

            {/* 隐私选择 & 发送 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.button
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                    privacy === 'whisper' ? 'bg-ink/10 text-ink' : 'text-ink-faint'
                  }`}
                  onClick={() => setPrivacy('whisper')}
                  whileTap={{ scale: 0.95 }}
                >
                  <Lock className="w-4 h-4" />
                  耳语
                </motion.button>
                <motion.button
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                    privacy === 'mark' ? 'bg-ink/10 text-ink' : 'text-ink-faint'
                  }`}
                  onClick={() => setPrivacy('mark')}
                  whileTap={{ scale: 0.95 }}
                >
                  <Volume2 className="w-4 h-4" />
                  刻痕
                </motion.button>
              </div>

              <motion.button
                className={`flex items-center gap-2 px-6 py-2 rounded-full font-serif ${
                  (text.trim() || capturedImage) && !isSending
                    ? 'bg-ink text-canvas'
                    : 'bg-ink/20 text-ink-faint'
                }`}
                onClick={handleSend}
                disabled={(!text.trim() && !capturedImage) || isSending}
                whileTap={{ scale: 0.95 }}
              >
                {isSending ? (
                  <motion.div
                    className="w-5 h-5 border-2 border-canvas/30 border-t-canvas rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    投递
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* 墨水化发送动效 */}
        <AnimatePresence>
          {isSending && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
            >
              <motion.div
                className="w-32 h-32 rounded-full bg-ink/80"
                initial={{ scale: 0.5 }}
                animate={{ 
                  scale: 3, 
                  filter: 'blur(30px)',
                  opacity: 0,
                }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
