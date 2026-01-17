import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { youwareVitePlugin } from "@youware/vite-plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [youwareVitePlugin(), react()],
  server: {
    host: "0.0.0.0",
    port: 7860,
    strictPort: false, // 如果5174被占用,自动尝试下一个端口
  },
  build: {
    sourcemap: true,
  },
});
