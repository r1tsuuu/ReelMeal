'use client';

import { type ReactNode } from 'react';
import { useIsFramed } from './useIsFramed';
import { FrameContext, useDeviceFrame } from './FrameContext';
import './DeviceFrame.css';

// Re-export so the public `@/components/DeviceFrame` index keeps the same
// shape. The hook + context live in FrameContext.tsx (CSS-free) so that
// components importing useDeviceFrame don't drag DeviceFrame.css into
// non-browser test runners (tsx can't parse the stylesheet).
export { useDeviceFrame };

interface DeviceFrameProps {
  children: ReactNode;
}

// When the viewport is narrow (< 768px), this is a pure passthrough: it renders
// children with zero added DOM, so the mobile experience is byte-identical to
// pre-frame behavior. When wide, it wraps children in the iPhone shell.
//
// REMOVAL: delete src/components/DeviceFrame/, revert the two `<DeviceFrame>`
// wrappers in page.tsx. Nothing else to undo.
export function DeviceFrame({ children }: DeviceFrameProps) {
  const framed = useIsFramed();

  if (!framed) {
    return <>{children}</>;
  }

  return (
    <FrameContext.Provider value={true}>
      <div className="df-ambient">
        <div className="df-phone">
          <div className="df-island" />
          <div className="df-screen">{children}</div>
        </div>
      </div>
    </FrameContext.Provider>
  );
}
