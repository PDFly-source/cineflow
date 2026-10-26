'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const ServiceWorkerRegistrar: React.FC = () => {
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register Service Worker in production
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.info('CineFlow updated in background.');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-950/90 border border-amber-600/40 text-amber-200 px-3.5 py-2 text-xs font-medium shadow-2xl backdrop-blur-md">
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
        <span>Offline Mode — Media playing locally from your device</span>
      </div>
    );
  }

  return null;
};
