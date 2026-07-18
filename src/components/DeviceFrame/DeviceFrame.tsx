'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useIsFramed } from './useIsFramed';
import './DeviceFrame.css';

// Overlays read this to know whether to anchor against the phone screen
// (`absolute`, true) or the browser viewport (`fixed`, false = today's behavior).
const FrameContext = createContext(false);
export const useDeviceFrame = () => useContext(FrameContext);

interface DeviceFrameProps {
  children: ReactNode;
}

// When the viewport is narrow (< 768px), this is a pure passthrough: it renders
// children with zero added DOM, so the mobile experience is byte-identical to
// pre-frame behavior. When wide, it wraps children in the iPhone shell.
//
// REMOVAL: delete src/components/DeviceFrame/, revert the two <DeviceFrame>
// wrappers in page.tsx, drop the @import in globals.css. Nothing else to undo.
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
