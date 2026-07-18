'use client';

import { useEffect, useState } from 'react';

// Single source of truth for the desktop-frame breakpoint. Must match the
// media query in DeviceFrame.css. 768px = Tailwind's `md`; below it, phones
// dominate and the app renders fullscreen (unchanged from pre-frame behavior).
export const FRAME_BREAKPOINT_PX = 768;

// SSR-safe: initial state is `false` so the server render and the first client
// render produce identical markup (no hydration mismatch). The effect corrects
// to the real viewport width after mount. On desktop the frame fades in via a
// CSS transition on .df-ambient, masking the one-frame flash.
export function useIsFramed(): boolean {
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${FRAME_BREAKPOINT_PX}px)`);
    const update = () => setFramed(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return framed;
}
