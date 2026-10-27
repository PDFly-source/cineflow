'use client';

import React, { useEffect } from 'react';

/**
 * Registers the service worker for offline support.
 * The persistent "Offline Mode" banner was removed at the owner's request:
 * offline capability itself (cached app shell + local media) is unchanged.
 */
export const ServiceWorkerRegistrar: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      // GitHub Pages deploys under a base path (/cineflow) — resolve the SW scope-relative.
      const swPath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/sw.js`;
      navigator.serviceWorker
        .register(swPath, { scope: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/` })
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
  }, []);

  return null;
};
