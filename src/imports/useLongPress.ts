'use client';

import { useRef } from 'react';
import { LONG_PRESS_MS } from '@/utils/constants';

/**
 * Press-and-hold for a single element: a quick tap fires `onClick`, holding for
 * `ms` fires `onLongPress` instead (and suppresses the click that follows release).
 * Spread the returned handlers onto the target element.
 */
export function useLongPress(onLongPress: () => void, onClick: () => void, ms: number = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const start = () => {
    fired.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, ms);
  };
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const handleClick = () => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    onClick();
  };

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onClick: handleClick,
  };
}
