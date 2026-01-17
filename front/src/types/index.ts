// 情绪类型
export type MoodType = 'melancholy' | 'warmth' | 'spark' | 'peace' | 'joy';

// 记录的隐私级别
export type PrivacyLevel = 'whisper' | 'mark'; // 耳语(私密) | 刻痕(公开)

// 位置信息
export interface Location {
  lat: number;
  lng: number;
  name?: string;
}

// 用户记录
export interface Memory {
  id: string;
  content: string;
  imageUrl?: string;
  location: Location;
  mood: MoodType;
  privacy: PrivacyLevel;
  createdAt: Date;
  resonanceCount: number;
}

// 地灵回信
export interface GeniusLociLetter {
  id: string;
  memoryId: string;
  content: string;
  linkedMemory?: Memory; // 关联的陌生人记录
  createdAt: Date;
}

// 足迹手账条目
export interface TraceEntry {
  memory: Memory;
  letter?: GeniusLociLetter;
}

// 情绪晕染点
export interface MoodSpot {
  id: string;
  location: Location;
  mood: MoodType;
  intensity: number; // 0-1, 情绪浓度
  memoriesCount: number;
}

// 共鸣场中的气泡
export interface ResonanceBubble {
  id: string;
  memory: Memory;
  position: { x: number; y: number };
  size: 'small' | 'medium' | 'large';
  opacity: number;
}

// 应用状态
export interface AppState {
  currentLocation: Location | null;
  isRecording: boolean;
  recordMode: 'photo' | 'text' | null;
  selectedMoodSpot: MoodSpot | null;
  memories: Memory[];
  letters: GeniusLociLetter[];
}
