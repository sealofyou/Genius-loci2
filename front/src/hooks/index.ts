import { useState, useEffect, useCallback, useRef } from 'react';
import type { Location } from '../types';

// 获取当前位置
export function useGeolocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('浏览器不支持地理定位');
      setLoading(false);
      // 使用默认位置 (北京)
      setLocation({ lat: 39.9087, lng: 116.3974, name: '北京' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
      },
      () => {
        setError('无法获取位置');
        setLoading(false);
        // 使用默认位置
        setLocation({ lat: 39.9087, lng: 116.3974, name: '北京' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { location, error, loading };
}

// 长按检测
export function useLongPress(
  onLongPress: () => void,
  onPress?: () => void,
  options: { threshold?: number; vibrate?: boolean } = {}
) {
  const { threshold = 500, vibrate = true } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    isLongPress.current = false;
    
    // 记录起始位置
    if ('touches' in e) {
      startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      startPos.current = { x: e.clientX, y: e.clientY };
    }

    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      if (vibrate && navigator.vibrate) {
        navigator.vibrate(50);
      }
      onLongPress();
    }, threshold);
  }, [onLongPress, threshold, vibrate]);

  const clear = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 检测是否有明显移动
    let endPos = { x: 0, y: 0 };
    if ('changedTouches' in e) {
      endPos = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    } else {
      endPos = { x: e.clientX, y: e.clientY };
    }

    const moved = Math.abs(endPos.x - startPos.current.x) > 10 ||
                  Math.abs(endPos.y - startPos.current.y) > 10;

    if (!isLongPress.current && !moved && onPress) {
      onPress();
    }
  }, [onPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: cancel,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: cancel,
  };
}

// 触觉反馈
export function useHaptic() {
  const trigger = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!navigator.vibrate) return;
    
    const patterns = {
      light: 10,
      medium: 50,
      heavy: 100,
    };
    
    navigator.vibrate(patterns[type]);
  }, []);

  return { trigger };
}
