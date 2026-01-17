import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { api, type Note, type Emotion } from '../api/client';

// 情绪颜色映射
const emotionColors: Record<Emotion, string> = {
  sad: '#8BA4C7',       // 淡蓝灰 - 忧伤
  happy: '#F4C542',     // 暖黄 - 快乐
  calm: '#A8D5BA',      // 淡绿 - 平静
  mysterious: '#B695C0', // 淡紫 - 神秘
  angry: '#E07A5F',     // 暖红 - 愤怒
};

// 情绪中文标签映射
const emotionLabels: Record<Emotion, string> = {
  sad: '忧伤',
  happy: '快乐',
  calm: '平静',
  mysterious: '神秘',
  angry: '愤怒',
};

// 情绪图标映射
const emotionIcons: Record<Emotion, string> = {
  sad: '💧',
  happy: '✨',
  calm: '🌿',
  mysterious: '🌙',
  angry: '🔥',
};

// 获取情绪颜色
const getEmotionColor = (emotion: Emotion | null): string => {
  return emotionColors[emotion || 'calm'] || emotionColors.calm;
};

// 获取情绪标签
const getEmotionLabel = (emotion: Emotion | null): string => {
  return emotionLabels[emotion || 'calm'] || emotionLabels.calm;
};

// 获取情绪图标
const getEmotionIcon = (emotion: Emotion | null): string => {
  return emotionIcons[emotion || 'calm'] || emotionIcons.calm;
};

// 用户位置图标
const userIcon = L.divIcon({
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#FAFAF5" stroke="#333" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="#333"/>
    </svg>
  `,
  className: 'user-location-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// 地图位置控制组件 - 禁用缩放和移动
function MapControl({ userLocation }: { userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    // 禁用所有交互
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    if (map.tap) map.tap.disable();
    
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 15);
    }
  }, [userLocation, map]);

  return null;
}

// 地图位置更新组件
function MapLocationUpdater({ userLocation }: { userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 15);
    }
  }, [userLocation, map]);

  return null;
}

// 单个萤火虫气泡组件（独立于地图，在屏幕上漂浮）
interface FireflyBubbleProps {
  note: Note;
  index: number;
  containerSize: { width: number; height: number };
  onClick: (note: Note) => void;
}

function FireflyBubble({ note, index, containerSize, onClick }: FireflyBubbleProps) {
  const controls = useAnimation();
  const color = getEmotionColor(note.emotion);
  
  // 随机初始位置（在容器内随机分布）
  const initialX = useRef(Math.random() * (containerSize.width - 60) + 30);
  const initialY = useRef(Math.random() * (containerSize.height - 60) + 30);
  
  // 布朗运动动画
  useEffect(() => {
    const animate = async () => {
      while (true) {
        // 随机生成下一个位置（在当前位置附近小范围移动）
        const deltaX = (Math.random() - 0.5) * 80;
        const deltaY = (Math.random() - 0.5) * 80;
        
        // 边界检查
        const newX = Math.max(30, Math.min(containerSize.width - 30, initialX.current + deltaX));
        const newY = Math.max(30, Math.min(containerSize.height - 30, initialY.current + deltaY));
        
        initialX.current = newX;
        initialY.current = newY;
        
        await controls.start({
          x: newX,
          y: newY,
          transition: {
            duration: 4 + Math.random() * 3, // 4-7秒的缓慢移动
            ease: 'easeInOut',
          },
        });
      }
    };
    
    if (containerSize.width > 0 && containerSize.height > 0) {
      animate();
    }
    
    return () => {
      controls.stop();
    };
  }, [controls, containerSize]);
  
  return (
    <motion.div
      className="absolute cursor-pointer z-[600]"
      style={{
        left: 0,
        top: 0,
        x: initialX.current,
        y: initialY.current,
      }}
      animate={controls}
      initial={{
        x: initialX.current,
        y: initialY.current,
        opacity: 0,
        scale: 0,
      }}
      whileInView={{
        opacity: 1,
        scale: 1,
      }}
      transition={{
        opacity: { delay: index * 0.1, duration: 0.5 },
        scale: { delay: index * 0.1, duration: 0.5 },
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(note);
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        onClick(note);
      }}
      whileTap={{ scale: 1.2 }}
    >
      {/* 点击区域扩大层 - 使用透明背景使父元素可接收点击 */}
      <div 
        className="absolute -inset-6 rounded-full" 
        onClick={(e) => {
          e.stopPropagation();
          onClick(note);
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          onClick(note);
        }}
      />
      {/* 外发光 */}
      <motion.div
        className="absolute -inset-4 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* 中层光晕 */}
      <motion.div
        className="absolute -inset-2 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}60 0%, transparent 70%)`,
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
      />
      {/* 核心光点 */}
      <motion.div
        className="w-6 h-6 rounded-full relative pointer-events-none"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}, 0 0 20px ${color}80`,
        }}
        animate={{
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}

// 气泡详情弹窗
interface BubbleDetailProps {
  note: Note;
  onClose: () => void;
}

function BubbleDetail({ note, onClose }: BubbleDetailProps) {
  const color = getEmotionColor(note.emotion);
  
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '';
    const d = new Date(timestamp * 1000);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <motion.div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-canvas/80 backdrop-blur-sm" />
      
      {/* 内容卡片 */}
      <motion.div
        className="relative max-w-sm w-full p-6 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-ink/5"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 情绪装饰 */}
        <div
          className="absolute -top-3 left-6 w-6 h-6 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 20px ${color}`,
          }}
        />
        
        {/* 时间、地点和情绪标签 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-ink-faint text-xs">
            <span>{formatDate(note.createdAt)}</span>
            {note.locationName && (
              <>
                <span>·</span>
                <span>{note.locationName}</span>
              </>
            )}
          </div>
          {/* 情绪标签：颜色图标 + 中文 */}
          <div 
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ 
              backgroundColor: `${color}20`,
              color: color 
            }}
          >
            <span>{getEmotionIcon(note.emotion)}</span>
            <span className="font-medium">{getEmotionLabel(note.emotion)}</span>
          </div>
        </div>

        {/* 图片（如果有） */}
        {note.imageUrl && (
          <div className="mb-4 rounded-xl overflow-hidden">
            <img 
              src={note.imageUrl} 
              alt="" 
              className="w-full h-48 object-cover"
            />
          </div>
        )}
        
        {/* 内容 */}
        <p className="text-ink font-serif leading-relaxed">
          {note.content}
        </p>
        
        {/* 底部提示 */}
        <p className="text-ink-faint/50 text-xs mt-6 text-center">
          点击任意处关闭
        </p>
      </motion.div>
    </motion.div>
  );
}

export function HomePage() {
  const [nearbyNotes, setNearbyNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [viewedNotes, setViewedNotes] = useState<Set<number>>(new Set());
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 获取容器尺寸
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 获取用户位置
  const getUserLocation = useCallback(() => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          setMapReady(true);
          setIsLocating(false);
          // 位置获取成功后加载附近笔记
          loadNearbyNotes(loc.lat, loc.lng);
        },
        (error) => {
          console.error('Geolocation error:', error);
          // 默认位置（北京）
          const defaultLoc = { lat: 39.915, lng: 116.404 };
          setUserLocation(defaultLoc);
          setMapReady(true);
          setIsLocating(false);
          loadNearbyNotes(defaultLoc.lat, defaultLoc.lng);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      // 默认位置
      const defaultLoc = { lat: 39.915, lng: 116.404 };
      setUserLocation(defaultLoc);
      setMapReady(true);
      setIsLocating(false);
      loadNearbyNotes(defaultLoc.lat, defaultLoc.lng);
    }
  }, []);

  // 加载附近笔记
  async function loadNearbyNotes(lat: number, lng: number) {
    try {
      const notes = await api.getNearbyNotes(lat, lng);
      // 最多展示30个
      setNearbyNotes(notes.slice(0, 30));
    } catch (error) {
      console.error('Failed to load nearby notes:', error);
    }
  }

  // 初始获取位置
  useEffect(() => {
    getUserLocation();
  }, [getUserLocation]);

  // 点击气泡
  const handleBubbleClick = (note: Note) => {
    setSelectedNote(note);
    // 标记为已查看
    setViewedNotes(prev => new Set(prev).add(note.id));
  };

  // 关闭详情
  const handleCloseDetail = () => {
    setSelectedNote(null);
  };

  // 过滤已查看的笔记
  const visibleNotes = nearbyNotes.filter(note => !viewedNotes.has(note.id));

  // 空状态
  const isEmpty = nearbyNotes.length === 0 && mapReady;

  // 地图加载前的占位
  const renderMapPlaceholder = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-canvas">
      <motion.div
        className="flex flex-col items-center gap-4"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-mood-melancholy/30 to-mood-warmth/30 blur-lg" />
        <p className="text-ink-faint font-serif text-sm">正在唤醒地图...</p>
      </motion.div>
    </div>
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-canvas flex flex-col">
      {/* 顶部标题区 - 固定在顶部 */}
      <motion.header
        className="relative z-[500] px-6 pt-4 pb-3 bg-canvas safe-area-top"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between">
          <div className="glass px-4 py-2 rounded-2xl">
            <h1 className="font-display text-xl text-ink tracking-wider">此间有灵</h1>
            <p className="text-ink-faint text-xs mt-0.5">跨越时空的静默共鸣</p>
          </div>
          <motion.div
            className="glass px-4 py-2 rounded-2xl text-right"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <p className="text-ink-faint text-xs">此刻周围</p>
            <p className="text-ink text-sm font-serif">
              {visibleNotes.length} 个故事
            </p>
          </motion.div>
        </div>
      </motion.header>

      {/* 地图区域 + 萤火虫气泡叠加层 - 中间弹性区域 */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
      >
        {/* 底层：Leaflet 地图 */}
        {!mapReady && renderMapPlaceholder()}
        {mapReady && userLocation && (
          <MapContainer
            center={[userLocation.lat, userLocation.lng]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            {/* 使用 CartoDB 浅色地图 - 更简洁美观 */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            
            <MapControl userLocation={userLocation} />
            <MapLocationUpdater userLocation={userLocation} />
            
            {/* 用户位置标记 */}
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>你的位置</Popup>
            </Marker>
          </MapContainer>
        )}

        {/* 地图覆盖层 - 柔和滤镜效果 */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-canvas/20 via-transparent to-canvas/20 z-[400]" />

        {/* 顶层：萤火虫气泡漂浮层（独立于地图，在屏幕可视区域内漂浮） */}
        {containerSize.width > 0 && visibleNotes.map((note, index) => (
          <FireflyBubble
            key={note.id}
            note={note}
            index={index}
            containerSize={containerSize}
            onClick={handleBubbleClick}
          />
        ))}

        {/* 空状态 */}
        {isEmpty && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center z-[500]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="glass px-6 py-4 rounded-2xl">
              <p className="text-ink-faint font-serif text-lg tracking-wider">
                风在等待你的故事。
              </p>
            </div>
          </motion.div>
        )}

        {/* 定位刷新按钮 */}
        <motion.button
          className="absolute bottom-4 right-4 z-[600] w-12 h-12 glass rounded-full flex items-center justify-center shadow-lg"
          whileTap={{ scale: 0.95 }}
          onClick={getUserLocation}
          disabled={isLocating}
        >
          <motion.div
            animate={isLocating ? { rotate: 360 } : { rotate: 0 }}
            transition={isLocating ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
          >
            <LocateFixed className={`w-5 h-5 ${isLocating ? 'text-ink-faint' : 'text-ink'}`} />
          </motion.div>
        </motion.button>
      </div>

      {/* 底部导航占位区 - 给 App.tsx 的导航栏留出空间 */}
      <div className="h-24 bg-canvas safe-area-bottom" />

      {/* 气泡详情弹窗 */}
      <AnimatePresence>
        {selectedNote && (
          <BubbleDetail
            note={selectedNote}
            onClose={handleCloseDetail}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
