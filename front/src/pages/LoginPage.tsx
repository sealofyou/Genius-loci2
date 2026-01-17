import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { client } from "../api/client";
import { useAuthStore } from "../store/authStore";

export function LoginPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const authRenderedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const { setUser } = useAuthStore();

  // 检查会话
  useEffect(() => {
    client.auth.getSession().then((session) => {
      if (session.data?.user) {
        setUser({
          id: session.data.user.id,
          email: session.data.user.email,
          name: session.data.user.name || "",
        });
      } else {
        setIsReady(true);
      }
    });
  }, [setUser]);

  // 渲染登录UI
  useEffect(() => {
    if (!isReady || authRenderedRef.current || !containerRef.current) return;
    authRenderedRef.current = true;

    client.auth.renderAuthUI(containerRef.current, {
      redirectTo: "/",
      onLogin: (user) => {
        setUser({
          id: user.id,
          email: user.email,
          name: user.name || "",
        });
      },
      labels: {
        signIn: {
          title: "此间有灵",
          subtitle: "跨越时空的静默共鸣",
          emailPlaceholder: "输入邮箱",
          passwordPlaceholder: "输入密码",
          loginButton: "进入",
          forgotPassword: "忘记密码？",
          signUpPrompt: "还没有账号？",
          toggleToSignUp: "立即注册",
        },
        signUp: {
          title: "加入此间",
          subtitle: "成为地灵的守护者",
          namePlaceholder: "你的名字",
          emailPlaceholder: "输入邮箱",
          passwordPlaceholder: "设置密码",
          signUpButton: "注册",
          signInPrompt: "已有账号？",
          toggleToSignIn: "去登录",
        },
      },
    });
  }, [isReady, setUser]);

  if (!isReady) {
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

  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center bg-canvas paper-texture overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, #B0C4DE 0%, transparent 70%)",
            left: "-10%",
            top: "10%",
            filter: "blur(60px)",
          }}
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, #D8BFD8 0%, transparent 70%)",
            right: "-10%",
            bottom: "20%",
            filter: "blur(60px)",
          }}
          animate={{
            scale: [1, 1.15, 1],
            y: [0, -20, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* 登录容器 */}
      <motion.div
        className="relative z-10 w-full max-w-md px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div
          ref={containerRef}
          style={{ width: "100%", maxWidth: 420 }}
        />
      </motion.div>
    </div>
  );
}
