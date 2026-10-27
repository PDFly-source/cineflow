import type { Metadata, Viewport } from 'next';
import './globals.css';
import { MediaProvider } from '@/context/MediaSessionContext';
import { Navbar } from '@/components/app-shell/Navbar';
import { SignatureFooter } from '@/components/app-shell/SignatureFooter';
import { BottomPillNav } from '@/components/navigation/BottomPillNav';
import { SplashScreen } from '@/components/brand/SplashScreen';
import { ServiceWorkerRegistrar } from '@/components/app-shell/ServiceWorkerRegistrar';

export const viewport: Viewport = {
  themeColor: '#080B14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'CineFlow — Private Local Video Player',
  description: 'Your Videos. Your Device. Your Control. Private, cinema-grade video playback with zero uploads, zero tracking, and local subtitle parsing.',
  applicationName: 'CineFlow',
  authors: [{ name: 'CineFlow Engineering' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CineFlow',
  },
  icons: {
    icon: [{ url: '/cineflow/favicon.ico', sizes: '32x32' }],
    apple: [
      { url: '/cineflow/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'CineFlow — Private Local Video Player',
    description: 'Your Videos. Your Device. Your Control. Privacy-first, browser-native cinematic video player with offline capability and zero cloud uploads.',
    type: 'website',
    siteName: 'CineFlow',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CineFlow — Private Local Video Player',
    description: 'Your Videos. Your Device. Your Control. Privacy-first, browser-native cinematic video player with offline capability and zero cloud uploads.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--ob)] text-[var(--tx)] antialiased selection:bg-[var(--ev)] selection:text-white flex flex-col font-sans">
        <MediaProvider>
          <SplashScreen />
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
          <SignatureFooter />
          <BottomPillNav />
          <ServiceWorkerRegistrar />
        </MediaProvider>
      </body>
    </html>
  );
}
