import type { MetadataRoute } from 'next';

const BASE_PATH = '/cineflow';

// Required for static export (output: 'export') metadata routes.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE_PATH}/`,
    name: 'CineFlow - Private Local Video Player',
    short_name: 'CineFlow',
    description: 'Privacy-first, browser-native cinematic video player with offline capability and zero cloud uploads.',
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: 'standalone',
    orientation: 'any',
    background_color: '#0a0d14',
    theme_color: '#0a0d14',
    icons: [
      {
        src: `${BASE_PATH}/pwa-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${BASE_PATH}/pwa-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${BASE_PATH}/maskable-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
