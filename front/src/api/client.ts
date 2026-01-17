/**
 * 此间有灵 - API Client
 * 使用 EdgeSpark Client 进行后端通信
 */

import { createEdgeSpark } from "@edgespark/client";
import "@edgespark/client/styles.css";

// 后端Worker URL
const WORKER_URL = "https://staging--mqr4yu18yguau4idyqmj.youbase.cloud";

// 创建EdgeSpark客户端
export const client = createEdgeSpark({
  baseUrl: WORKER_URL,
});

// 情绪枚举
export type Emotion = "sad" | "happy" | "calm" | "mysterious" | "angry";

// 类型定义
export interface Note {
  id: number;
  userId: string;
  content: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  emotion: Emotion | null;
  mode: string | null;
  isPrivate: number | null;
  aiSummary: string | null;
  createdAt: number | null;
  imageUrl: string | null;
}

export interface Chat {
  id: number;
  userId: string;
  noteId: number | null;
  role: string;
  content: string;
  createdAt: number | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

// API 函数
export const api = {
  // 获取1公里范围内的笔记（气泡显示）
  async getNearbyNotes(lat: number, lng: number): Promise<Note[]> {
    const res = await client.api.fetch(`/api/public/nearby-notes?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    return data.data || [];
  },

  // 获取公开笔记（兼容旧接口）
  async getPublicNotes(): Promise<Note[]> {
    const res = await client.api.fetch("/api/public/notes");
    const data = await res.json();
    return data.data || [];
  },

  // 获取当前用户
  async getMe(): Promise<User | null> {
    try {
      const res = await client.api.fetch("/api/me");
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // 获取用户笔记
  async getNotes(): Promise<Note[]> {
    const res = await client.api.fetch("/api/notes");
    const data = await res.json();
    return data.data || [];
  },

  // 创建笔记
  async createNote(note: {
    content: string;
    latitude?: number;
    longitude?: number;
    locationName?: string;
    emotion?: Emotion;
    mode?: string;
    isPrivate?: boolean;
  }): Promise<Note> {
    const res = await client.api.fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    });
    const data = await res.json();
    return data.data;
  },

  // 获取笔记聊天记录
  async getNoteChats(noteId: number): Promise<Chat[]> {
    const res = await client.api.fetch(`/api/notes/${noteId}/chats`);
    const data = await res.json();
    return data.data || [];
  },

  // 生成AI总结
  async generateSummary(noteId: number): Promise<string> {
    const res = await client.api.fetch("/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId }),
    });
    const data = await res.json();
    return data.data?.summary || "";
  },

  // 删除笔记
  async deleteNote(noteId: number): Promise<void> {
    await client.api.fetch(`/api/notes/${noteId}`, {
      method: "DELETE",
    });
  },
};
