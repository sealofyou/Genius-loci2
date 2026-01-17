import { useEffect, useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HomePage } from "./pages/HomePage";
import { LetterPage } from "./pages/LetterPage";
import { TracesPage } from "./pages/TracesPage";
import { LoginPage } from "./pages/LoginPage";
import { ChatPage } from "./pages/ChatPage";
import { RecordModal, type RecordMode, type SpiritMode } from "./components/record/RecordModal";
import { Sparkles, Map, PenLine, Lightbulb, LogOut } from "lucide-react";
import { client, api } from "./api/client";
import { useAuthStore } from "./store/authStore";

type Page = "home" | "letters" | "traces" | "chat";

// Toast 组件
function Toast({ message, isVisible }: { message: string; isVisible: boolean }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed top-1/2 left-1/2 z-[2000] -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
        >
          <div className="px-6 py-3 bg-ink/80 backdrop-blur-sm rounded-full text-white font-serif text-sm shadow-xl">
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 墨水消散动画组件
function InkDissipate({ isActive, onComplete }: { isActive: boolean; onComplete: () => void }) {
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 z-[1500] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* 墨水粒子效果 */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-4 h-4 rounded-full bg-ink/30"
              style={{
                left: `${30 + Math.random() * 40}%`,
                top: `${30 + Math.random() * 40}%`,
              }}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{
                scale: [1, 2, 0],
                opacity: [0.6, 0.3, 0],
                x: (Math.random() - 0.5) * 200,
                y: (Math.random() - 0.5) * 200,
              }}
              transition={{
                duration: 1.2,
                delay: i * 0.05,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [chatNoteId, setChatNoteId] = useState<number | null>(null);
  const { user, isChecking, setUser, setChecking, reset } = useAuthStore();

  // 记录模态框状态
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<RecordMode>("camera");
  
  // 动画状态
  const [showInkDissipate, setShowInkDissipate] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // 长按检测
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const LONG_PRESS_DURATION = 150; // 150ms

  // 恢复会话
  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    if (useAuthStore.getState().user) {
      setChecking(false);
      return;
    }
    try {
      const session = await client.auth.getSession();
      if (session.data?.user) {
        setUser({
          id: session.data.user.id,
          email: session.data.user.email,
          name: session.data.user.name || "",
        });
      }
    } finally {
      setChecking(false);
    }
  }

  // 登出
  async function handleLogout() {
    await client.auth.signOut();
    reset();
  }

  // 打开聊天页面
  function openChat(noteId: number) {
    setChatNoteId(noteId);
    setCurrentPage("chat");
  }

  // 记录按钮 - 按下
  const handleRecordButtonDown = useCallback(() => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      // 长按 - 纯文本模式
      setRecordMode("text");
      setRecordModalOpen(true);
    }, LONG_PRESS_DURATION);
  }, []);

  // 记录按钮 - 松开
  const handleRecordButtonUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      // 短按 - 相机模式
      setRecordMode("camera");
      setRecordModalOpen(true);
    }
  }, []);

  // 记录按钮 - 离开（取消）
  const handleRecordButtonLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // 显示 Toast
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // 保存记录
  const handleSaveRecord = async (data: {
    content: string;
    imageUrl?: string;
    spiritMode: SpiritMode;
  }) => {
    try {
      // 获取当前位置
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch {
        console.log("无法获取位置");
      }

      // 创建笔记
      const note = await api.createNote({
        content: data.content,
        latitude,
        longitude,
        emotion: "calm", // 后端会异步进行AI情绪打标
        mode: data.spiritMode,
        isPrivate: false,
      });

      // 关闭模态框
      setRecordModalOpen(false);

      if (data.spiritMode === "trace") {
        // 留痕模式 - 墨水消散动效 + Toast + 返回地图
        setShowInkDissipate(true);
        showToastMessage("记忆已刻入");
      } else {
        // 唤灵模式 - 进入聊天界面
        setChatNoteId(note.id);
        setCurrentPage("chat");
      }
    } catch (error) {
      console.error("保存失败:", error);
      showToastMessage("保存失败，请重试");
    }
  };

  // 墨水消散完成
  const handleInkDissipateComplete = useCallback(() => {
    setShowInkDissipate(false);
  }, []);

  // 显示加载状态
  if (isChecking) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-canvas paper-texture">
        <motion.div
          className="flex flex-col items-center gap-4"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-mood-melancholy/30 to-mood-warmth/30 blur-lg" />
          <p className="text-ink-faint font-serif text-sm">正在唤醒地灵...</p>
        </motion.div>
      </div>
    );
  }

  // 未登录显示登录页
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-canvas">
      <AnimatePresence mode="wait">
        {currentPage === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <HomePage />
          </motion.div>
        )}
        {currentPage === "letters" && (
          <motion.div
            key="letters"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full"
          >
            <LetterPage 
              onBack={() => setCurrentPage("home")} 
              onOpenChat={openChat}
            />
          </motion.div>
        )}
        {currentPage === "traces" && (
          <motion.div
            key="traces"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full"
          >
            <TracesPage onBack={() => setCurrentPage("home")} />
          </motion.div>
        )}
        {currentPage === "chat" && chatNoteId && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="h-full"
          >
            <ChatPage 
              noteId={chatNoteId} 
              onBack={() => setCurrentPage("home")} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 顶部右上角 - 召唤地灵按钮和登出 */}
      {currentPage === "home" && (
        <motion.div
          className="fixed top-0 right-0 safe-area-top z-30 px-4 pt-4 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.button
            className="flex items-center gap-1.5 px-3 py-1.5 glass rounded-full text-ink"
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              // 召唤地灵功能 - 后续实现
            }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-serif">召唤地灵</span>
          </motion.button>
          <motion.button
            className="p-2 glass rounded-full text-ink-faint"
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
          </motion.button>
        </motion.div>
      )}

      {/* 底部导航 - 只在首页显示 */}
      {currentPage === "home" && (
        <motion.nav
          className="fixed bottom-0 left-0 right-0 safe-area-bottom z-20"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-around px-6 py-2 mx-4 mb-2 glass rounded-full">
            <NavButton
              icon={<Map className="w-5 h-5" />}
              label="地图"
              isActive={true}
              onClick={() => setCurrentPage("home")}
            />
            {/* 中间大按钮 - 记录（支持短按/长按） */}
            <motion.button
              className="relative -mt-6 flex flex-col items-center select-none touch-none"
              whileTap={{ scale: 0.95 }}
              onMouseDown={handleRecordButtonDown}
              onMouseUp={handleRecordButtonUp}
              onMouseLeave={handleRecordButtonLeave}
              onTouchStart={handleRecordButtonDown}
              onTouchEnd={handleRecordButtonUp}
              onTouchCancel={handleRecordButtonLeave}
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-mood-melancholy to-mood-warmth flex items-center justify-center shadow-lg">
                <PenLine className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-serif text-ink mt-1">记录</span>
            </motion.button>
            <NavButton
              icon={<Lightbulb className="w-5 h-5" />}
              label="想法"
              isActive={false}
              onClick={() => setCurrentPage("traces")}
            />
          </div>
        </motion.nav>
      )}

      {/* 记录模态框 */}
      <RecordModal
        isOpen={recordModalOpen}
        mode={recordMode}
        onClose={() => setRecordModalOpen(false)}
        onSave={handleSaveRecord}
      />

      {/* 墨水消散动画 */}
      <InkDissipate 
        isActive={showInkDissipate} 
        onComplete={handleInkDissipateComplete} 
      />

      {/* Toast 提示 */}
      <Toast message={toastMessage} isVisible={showToast} />
    </div>
  );
}

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function NavButton({ icon, label, isActive, onClick }: NavButtonProps) {
  return (
    <motion.button
      className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-full transition-colors ${
        isActive ? "text-ink" : "text-ink-faint"
      }`}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
    >
      {icon}
      <span className="text-xs font-serif">{label}</span>
    </motion.button>
  );
}

export default App;
