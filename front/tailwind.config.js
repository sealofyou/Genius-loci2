/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 画布色
        canvas: '#FAFAF5',
        parchment: '#F5F2EB',
        // 墨迹色
        ink: {
          DEFAULT: '#333333',
          light: '#666666',
          faint: '#999999',
        },
        // 情绪水彩
        mood: {
          melancholy: '#B0C4DE', // 雾霾蓝 - 忧郁
          warmth: '#D8BFD8',     // 干枯玫瑰粉 - 温暖
          spark: '#8FBC8F',      // 鼠尾草绿 - 灵感
          peace: '#DEB887',      // 淡褐色 - 平静
          joy: '#F4A460',        // 沙棕色 - 喜悦
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', 'Georgia', '"Songti SC"', 'serif'],
        display: ['"Noto Serif SC"', 'Georgia', '"Songti SC"', 'serif'],
      },
      animation: {
        'breathe': 'breathe 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'ripple': 'ripple 2s ease-out infinite',
        'ink-spread': 'inkSpread 1.5s ease-out forwards',
        'bubble-rise': 'bubbleRise 8s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        ripple: {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        inkSpread: {
          '0%': { transform: 'scale(1)', filter: 'blur(0px)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', filter: 'blur(4px)', opacity: '0.6' },
          '100%': { transform: 'scale(1.5)', filter: 'blur(12px)', opacity: '0' },
        },
        bubbleRise: {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0.6' },
          '25%': { transform: 'translateY(-5vh) translateX(5px)', opacity: '0.8' },
          '50%': { transform: 'translateY(-10vh) translateX(-5px)', opacity: '0.7' },
          '75%': { transform: 'translateY(-15vh) translateX(3px)', opacity: '0.5' },
          '100%': { transform: 'translateY(-20vh) translateX(0)', opacity: '0.3' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'watercolor': '0 0 40px -10px rgba(176, 196, 222, 0.5)',
        'ink': '0 2px 10px rgba(51, 51, 51, 0.1)',
      },
    },
  },
  plugins: [],
}
