# 此间有灵 Spirit Loci

跨越时空的静默共鸣。基于地理位置的零压力共鸣网络。

## 项目概览

「此间有灵」是一款零压力社交应用，通过"地点"这个中介，让不同时空的人在同一位置留下的故事与情绪产生奇妙的共鸣。没有关注、点赞和评论的压力，只有纯粹的情感连接。

## 核心功能

### 1. 地图首页
- 萤火虫气泡效果（布朗运动）
- 点击气泡查看陌生人的故事
- 气泡消失时淡出动效
- 右上角「召唤地灵」按钮

### 2. 记录功能
- 留痕模式：单纯记录心情
- 唤灵模式：记录后与地灵AI对话
- 情绪选择和隐私设置

### 3. 唤灵对话
- 多轮AI对话
- 流式响应
- 地灵角色扮演（温暖、诗意）

### 4. 我的想法
- 单列卡片展示
- AI生成的地灵寄语
- 基于记录和对话的总结

## UI 设计规范

### 配色方案
- 画布：米白 `#FAFAF5`
- 墨迹：深炭灰 `#333333`
- 情绪水彩：
  - 忧郁：雾霾蓝 `#B0C4DE`
  - 温暖：干枯玫瑰粉 `#D8BFD8`
  - 灵感：鼠尾草绿 `#8FBC8F`
  - 平静：淡褐色 `#DEB887`
  - 喜悦：沙棕色 `#F4A460`

### 动效原则
- 慢：所有呼吸、晕染动效都要慢，营造静谧感
- 柔：避免生硬弹窗，使用溶解、模糊转场

### 字体
- 主字体：Noto Serif SC
- 后备字体：Georgia, Songti SC, serif

## 技术栈

- React 18 + TypeScript
- Vite 构建
- Tailwind CSS 样式
- Framer Motion 动画
- Zustand 状态管理
- Youbase 后端（Hono + Drizzle ORM）

## 后端 API

- `GET /api/public/notes` - 获取公开笔记
- `GET /api/notes` - 获取用户笔记
- `POST /api/notes` - 创建笔记
- `DELETE /api/notes/:id` - 删除笔记
- `GET /api/notes/:noteId/chats` - 获取聊天记录
- `POST /api/ai/chat` - AI聊天（流式）
- `POST /api/ai/summary` - 生成AI总结

## 地图集成

- 使用百度地图 JS API v3.0
- API Key 已配置在 index.html 中
- 地图显示用户位置和公开笔记标记
- 标记颜色基于情绪类型

- `notes` - 笔记/记录
- `chats` - 聊天记录

## 构建命令

```bash
npm install    # 安装依赖
npm run build  # 生产构建
```
