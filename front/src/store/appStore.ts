import { create } from 'zustand';
import type { Memory, GeniusLociLetter, MoodSpot, Location, MoodType } from '../types';

// 模拟数据 - 情绪晕染点
const mockMoodSpots: MoodSpot[] = [
  {
    id: '1',
    location: { lat: 39.9087, lng: 116.3974, name: '三里屯' },
    mood: 'melancholy',
    intensity: 0.8,
    memoriesCount: 32,
  },
  {
    id: '2',
    location: { lat: 39.9163, lng: 116.3971, name: '工人体育场' },
    mood: 'joy',
    intensity: 0.6,
    memoriesCount: 18,
  },
  {
    id: '3',
    location: { lat: 39.9042, lng: 116.4074, name: '朝阳公园' },
    mood: 'peace',
    intensity: 0.7,
    memoriesCount: 45,
  },
  {
    id: '4',
    location: { lat: 39.9219, lng: 116.4163, name: '798艺术区' },
    mood: 'spark',
    intensity: 0.9,
    memoriesCount: 67,
  },
  {
    id: '5',
    location: { lat: 39.9956, lng: 116.3262, name: '北京大学' },
    mood: 'warmth',
    intensity: 0.5,
    memoriesCount: 23,
  },
];

// 模拟数据 - 陌生人的记录
const mockMemories: Memory[] = [
  {
    id: 'm1',
    content: '深夜的三里屯，霓虹灯下每个人都在假装快乐。而我只想安静地坐在这里，看着人来人往。',
    location: { lat: 39.9087, lng: 116.3974, name: '三里屯' },
    mood: 'melancholy',
    privacy: 'mark',
    createdAt: new Date('2026-01-15T23:30:00'),
    resonanceCount: 12,
  },
  {
    id: 'm2',
    content: '第一次来798，阳光透过厂房的窗户洒进来，突然觉得生活还是很美好的。',
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400',
    location: { lat: 39.9219, lng: 116.4163, name: '798艺术区' },
    mood: 'spark',
    privacy: 'mark',
    createdAt: new Date('2026-01-16T14:20:00'),
    resonanceCount: 28,
  },
  {
    id: 'm3',
    content: '朝阳公园的傍晚，老人们在跳舞，孩子们在奔跑。这才是生活该有的样子吧。',
    location: { lat: 39.9042, lng: 116.4074, name: '朝阳公园' },
    mood: 'peace',
    privacy: 'mark',
    createdAt: new Date('2026-01-16T17:45:00'),
    resonanceCount: 8,
  },
  {
    id: 'm4',
    content: '凌晨两点的便利店，店员小哥递过热咖啡时笑了笑。简单的温暖。',
    location: { lat: 39.9087, lng: 116.3974, name: '三里屯' },
    mood: 'warmth',
    privacy: 'mark',
    createdAt: new Date('2026-01-17T02:15:00'),
    resonanceCount: 19,
  },
  {
    id: 'm5',
    content: '演唱会结束，耳边还回响着那首歌。和三万人一起大声唱出来的感觉真好。',
    location: { lat: 39.9163, lng: 116.3971, name: '工人体育场' },
    mood: 'joy',
    privacy: 'mark',
    createdAt: new Date('2026-01-14T22:00:00'),
    resonanceCount: 56,
  },
];

// 地灵回信模板
const letterTemplates: Record<MoodType, string[]> = {
  melancholy: [
    '我听见了你的叹息，它轻轻落在这片土地上，和无数个深夜一样温柔。',
    '忧伤也是一种力量，它让我们更真实地感受这个世界。',
  ],
  warmth: [
    '温暖是会传递的，就像你现在感受到的这样。这里还有人懂你。',
    '在这座城市的某个角落，总有一盏灯为你亮着。',
  ],
  spark: [
    '灵感是时空的馈赠，你刚好接住了这一份。',
    '创造力在这里流淌，你正是这条河流的一部分。',
  ],
  peace: [
    '平静是最珍贵的礼物，此刻你正拥有它。',
    '在喧嚣的世界里找到宁静，是一种了不起的能力。',
  ],
  joy: [
    '快乐会在空气中留下痕迹，你感受到的，是无数人曾经的欢笑。',
    '这一刻的喜悦，将成为这片土地最美的记忆之一。',
  ],
};

interface AppStore {
  // 状态
  currentLocation: Location | null;
  moodSpots: MoodSpot[];
  memories: Memory[];
  userMemories: Memory[];
  letters: GeniusLociLetter[];
  selectedSpot: MoodSpot | null;
  isRecording: boolean;
  recordMode: 'photo' | 'text' | null;
  showResonanceField: boolean;
  
  // 操作
  setCurrentLocation: (location: Location | null) => void;
  selectMoodSpot: (spot: MoodSpot | null) => void;
  startRecording: (mode: 'photo' | 'text') => void;
  stopRecording: () => void;
  addMemory: (memory: Omit<Memory, 'id' | 'createdAt' | 'resonanceCount'>) => void;
  addResonance: (memoryId: string) => void;
  openResonanceField: () => void;
  closeResonanceField: () => void;
  getMemoriesBySpot: (spotId: string) => Memory[];
  generateLetter: (memory: Memory) => GeniusLociLetter;
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentLocation: { lat: 39.9087, lng: 116.3974, name: '北京' },
  moodSpots: mockMoodSpots,
  memories: mockMemories,
  userMemories: [],
  letters: [],
  selectedSpot: null,
  isRecording: false,
  recordMode: null,
  showResonanceField: false,

  setCurrentLocation: (location) => set({ currentLocation: location }),

  selectMoodSpot: (spot) => set({ selectedSpot: spot }),

  startRecording: (mode) => set({ isRecording: true, recordMode: mode }),

  stopRecording: () => set({ isRecording: false, recordMode: null }),

  addMemory: (memoryData) => {
    const newMemory: Memory = {
      ...memoryData,
      id: `user_${Date.now()}`,
      createdAt: new Date(),
      resonanceCount: 0,
    };
    
    set((state) => ({
      userMemories: [newMemory, ...state.userMemories],
    }));

    // 生成地灵回信
    const letter = get().generateLetter(newMemory);
    set((state) => ({
      letters: [letter, ...state.letters],
    }));

    return newMemory;
  },

  addResonance: (memoryId) => {
    set((state) => ({
      memories: state.memories.map((m) =>
        m.id === memoryId ? { ...m, resonanceCount: m.resonanceCount + 1 } : m
      ),
    }));
  },

  openResonanceField: () => set({ showResonanceField: true }),

  closeResonanceField: () => set({ showResonanceField: false }),

  getMemoriesBySpot: (spotId) => {
    const spot = get().moodSpots.find((s) => s.id === spotId);
    if (!spot) return [];
    
    return get().memories.filter(
      (m) => Math.abs(m.location.lat - spot.location.lat) < 0.01 &&
             Math.abs(m.location.lng - spot.location.lng) < 0.01
    );
  },

  generateLetter: (memory) => {
    const templates = letterTemplates[memory.mood];
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    
    // 找一个相似情绪的陌生人记录
    const relatedMemories = get().memories.filter(
      (m) => m.mood === memory.mood && m.id !== memory.id
    );
    const linkedMemory = relatedMemories.length > 0
      ? relatedMemories[Math.floor(Math.random() * relatedMemories.length)]
      : undefined;

    const letterContent = linkedMemory
      ? `${randomTemplate}\n\n这也让我想起了，有人曾在这里留下过相似的足迹……`
      : randomTemplate;

    return {
      id: `letter_${Date.now()}`,
      memoryId: memory.id,
      content: letterContent,
      linkedMemory,
      createdAt: new Date(),
    };
  },
}));
