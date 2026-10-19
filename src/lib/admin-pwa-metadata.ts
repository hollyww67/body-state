import type { Metadata, Viewport } from 'next';

export const adminPwaMetadata: Metadata = {
  manifest: '/admin-manifest.webmanifest',
  appleWebApp: { capable: true, title: 'BODY STATE · Админ', statusBarStyle: 'default' },
  icons: { icon: '/logo.png', apple: '/admin-icons/apple.png' },
  robots: { index: false, follow: false },
};
export const adminViewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  interactiveWidget: 'resizes-content', themeColor: '#F6F8F5',
};
