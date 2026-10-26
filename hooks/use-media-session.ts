import { useEffect } from 'react';
import { formatVideoTitle } from '@/lib/utils/formatters';

interface MediaSessionProps {
  title?: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeekBackward: () => void;
  onSeekForward: () => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  onSeekTo?: (time: number) => void;
  duration?: number;
  currentTime?: number;
}

export function useMediaSession({
  title,
  isPlaying,
  onPlay,
  onPause,
  onSeekBackward,
  onSeekForward,
  onPreviousTrack,
  onNextTrack,
  onSeekTo,
  duration,
  currentTime,
}: MediaSessionProps) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (title) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: formatVideoTitle(title),
        artist: 'CineFlow Local Player',
        album: 'Offline Media',
        artwork: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    try {
      navigator.mediaSession.setActionHandler('play', onPlay);
      navigator.mediaSession.setActionHandler('pause', onPause);
      navigator.mediaSession.setActionHandler('seekbackward', onSeekBackward);
      navigator.mediaSession.setActionHandler('seekforward', onSeekForward);

      if (onPreviousTrack) {
        navigator.mediaSession.setActionHandler('previoustrack', onPreviousTrack);
      } else {
        navigator.mediaSession.setActionHandler('previoustrack', null);
      }

      if (onNextTrack) {
        navigator.mediaSession.setActionHandler('nexttrack', onNextTrack);
      } else {
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }

      if (onSeekTo) {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            onSeekTo(details.seekTime);
          }
        });
      }
    } catch (e) {
      console.warn('MediaSession handler setup failed:', e);
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    };
  }, [
    title,
    isPlaying,
    onPlay,
    onPause,
    onSeekBackward,
    onSeekForward,
    onPreviousTrack,
    onNextTrack,
    onSeekTo,
  ]);

  // Update position state if available
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('mediaSession' in navigator) ||
      !navigator.mediaSession.setPositionState ||
      !duration ||
      duration <= 0 ||
      currentTime === undefined
    ) {
      return;
    }

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate: 1,
        position: Math.min(Math.max(0, currentTime), duration),
      });
    } catch {}
  }, [currentTime, duration]);
}
