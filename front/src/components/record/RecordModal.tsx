/**
 * 记录模态框组件
 * 
 * 支持两种打开方式：
 * - 短按：相机拍照 -> 照片预览 + 输入框
 * - 长按：纯文本输入
 * 
 * 支持两种模式：
 * - 留痕 (Trace)：不与地灵聊，保存后返回地图
 * - 唤灵 (Awaken)：与地灵聊，保存后进入聊天
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Send, MessageCircle } from 'lucide-react';

export type RecordMode = 'camera' | 'text';
export type SpiritMode = 'trace' | 'awaken';

interface RecordModalProps {
  isOpen: boolean;
  mode: RecordMode;
  onClose: () => void;
  onSave: (data: {
    content: string;
    imageUrl?: string;
    spiritMode: SpiritMode;
  }) => void;
}

export function RecordModal({ isOpen, mode, onClose, onSave }: RecordModalProps) {
  const [step, setStep] = useState<'camera' | 'input'>('camera');
  const [imageData, setImageData] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [spiritMode, setSpiritMode] = useState<SpiritMode>('awaken'); // 默认开启与地灵聊
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setStep(mode === 'camera' ? 'camera' : 'input');
      setImageData(null);
      setContent('');
      setSpiritMode('awaken');
      setIsSaving(false);
      
      // 纯文本模式直接聚焦输入框
      if (mode === 'text') {
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    } else {
      // 关闭时停止相机
      stopCamera();
    }
  }, [isOpen, mode]);

  // 启动相机
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('无法启动相机:', error);
      // 降级到文件选择
      fileInputRef.current?.click();
    }
  }, []);

  // 停止相机
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // 相机模式时启动相机
  useEffect(() => {
    if (isOpen && mode === 'camera' && step === 'camera') {
      startCamera();
    }
    return () => {
      if (step !== 'camera') {
        stopCamera();
      }
    };
  }, [isOpen, mode, step, startCamera, stopCamera]);

  // 拍照
  const takePhoto = useCallback(() => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImageData(dataUrl);
      stopCamera();
      setStep('input');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [stopCamera]);

  // 处理文件选择（降级方案）
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageData(event.target?.result as string);
        setStep('input');
        setTimeout(() => textareaRef.current?.focus(), 100);
      };
      reader.readAsDataURL(file);
    }
  };

  // 保存
  const handleSave = async () => {
    if (!content.trim() && !imageData) return;
    
    setIsSaving(true);
    try {
      await onSave({
        content: content.trim(),
        imageUrl: imageData || undefined,
        spiritMode,
      });
    } catch (error) {
      console.error('保存失败:', error);
      setIsSaving(false);
    }
  };

  // 关闭
  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1000]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* 背景 - 毛玻璃效果 */}
        <div className="absolute inset-0 bg-canvas/60 backdrop-blur-xl" />

        {/* 关闭按钮 */}
        <motion.button
          className="absolute top-4 right-4 safe-area-top z-10 p-3 glass rounded-full"
          whileTap={{ scale: 0.95 }}
          onClick={handleClose}
        >
          <X className="w-5 h-5 text-ink" />
        </motion.button>

        {/* 相机拍照界面 */}
        {mode === 'camera' && step === 'camera' && (
          <motion.div
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* 视频预览 */}
            <div className="flex-1 relative overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* 取景框装饰 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/30 rounded-3xl" />
              </div>
            </div>

            {/* 拍照按钮 */}
            <div className="relative z-10 pb-12 pt-6 flex justify-center safe-area-bottom">
              <motion.button
                className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-xl"
                whileTap={{ scale: 0.9 }}
                onClick={takePhoto}
              >
                <div className="w-16 h-16 rounded-full border-4 border-ink/20" />
              </motion.button>
            </div>

            {/* 隐藏的文件输入（降级方案） */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </motion.div>
        )}

        {/* 输入界面（拍照后或纯文本模式） */}
        {(step === 'input' || mode === 'text') && (
          <motion.div
            className="absolute inset-0 flex flex-col safe-area-top safe-area-bottom"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {/* 照片预览（如果有） */}
            {imageData && (
              <div className="relative flex-shrink-0 h-[45%] overflow-hidden">
                <img
                  src={imageData}
                  alt="拍摄的照片"
                  className="w-full h-full object-cover"
                />
                {/* 渐变遮罩 */}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-canvas/80 to-transparent" />
              </div>
            )}

            {/* 输入区域 */}
            <div className={`flex-1 flex flex-col px-6 ${imageData ? 'pt-4' : 'pt-20 justify-center'}`}>
              {/* 纯文本模式的标题 */}
              {!imageData && (
                <motion.h2
                  className="text-2xl font-display text-ink text-center mb-8"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  记录此刻
                </motion.h2>
              )}

              {/* 输入框 */}
              <div className="glass rounded-2xl p-4 flex-shrink-0">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={imageData ? "为这一刻写下文字..." : "写下你的想法..."}
                  className="w-full bg-transparent text-ink font-serif text-base leading-relaxed resize-none outline-none placeholder:text-ink-faint/50"
                  rows={imageData ? 3 : 6}
                  maxLength={500}
                />
                <div className="flex justify-end mt-2">
                  <span className="text-xs text-ink-faint">{content.length}/500</span>
                </div>
              </div>

              {/* 底部操作栏 */}
              <div className="mt-auto pb-6 flex items-center justify-between">
                {/* 左下角 - 地灵开关 */}
                <motion.button
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                    spiritMode === 'awaken'
                      ? 'bg-mood-warmth/20 text-ink'
                      : 'bg-ink/5 text-ink-faint'
                  }`}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSpiritMode(spiritMode === 'awaken' ? 'trace' : 'awaken')}
                >
                  <MessageCircle className={`w-4 h-4 ${spiritMode === 'awaken' ? 'text-mood-warmth' : ''}`} />
                  <span className="text-sm font-serif">
                    {spiritMode === 'awaken' ? '与地灵聊' : '仅留痕'}
                  </span>
                  {/* 开关指示器 */}
                  <div className={`w-8 h-4 rounded-full transition-colors ${
                    spiritMode === 'awaken' ? 'bg-mood-warmth' : 'bg-ink/20'
                  }`}>
                    <motion.div
                      className="w-3 h-3 bg-white rounded-full mt-0.5"
                      animate={{ x: spiritMode === 'awaken' ? 16 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </div>
                </motion.button>

                {/* 右下角 - 保存按钮 */}
                <motion.button
                  className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-lg transition-all ${
                    content.trim() || imageData
                      ? 'bg-gradient-to-r from-mood-melancholy to-mood-warmth text-white'
                      : 'bg-ink/10 text-ink-faint'
                  }`}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSave}
                  disabled={isSaving || (!content.trim() && !imageData)}
                >
                  {isSaving ? (
                    <motion.div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  <span className="font-serif">保存</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
