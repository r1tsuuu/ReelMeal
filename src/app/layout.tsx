import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReelMeal',
  description: 'Extract recipes from cooking videos instantly',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ReelMeal',
  },
  icons: [
    { rel: 'icon', url: '/icon-192.png', sizes: '192x192' },
    { rel: 'apple-touch-icon', url: '/icon-192.png' },
  ],
};

export const viewport: Viewport = {
  themeColor: '#C75B3F',
};

// Service worker registration is handled by next-pwa's `register: true`
// (see next.config.js) — it's a no-op in dev since the plugin is disabled there.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
