import { useEffect } from 'react';

export interface ShortcutHandlers {
  onTogglePlay?: () => void;
  onSeek?: (deltaSeconds: number) => void;
  onVolumeChange?: (deltaVolume: number) => void;
  onToggleMute?: () => void;
  onToggleFullscreen?: () => void;
  onToggleSubtitles?: () => void;
  onChangeSpeed?: (delta: number) => void;
  onSetABPointA?: () => void;
  onSetABPointB?: () => void;
  onClearABRepeat?: () => void;
  onEscape?: () => void;
  seekInterval?: number;
  isEnabled?: boolean;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onToggleSubtitles,
  onChangeSpeed,
  onSetABPointA,
  onSetABPointB,
  onClearABRepeat,
  onEscape,
  seekInterval = 10,
  isEnabled = true,
}: ShortcutHandlers) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept keyboard shortcuts if user is typing in form inputs
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          onTogglePlay?.();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          onSeek?.(-seekInterval);
          break;

        case 'ArrowRight':
          e.preventDefault();
          onSeek?.(seekInterval);
          break;

        case 'KeyJ':
          e.preventDefault();
          onSeek?.(-10);
          break;

        case 'KeyL':
          e.preventDefault();
          onSeek?.(10);
          break;

        case 'ArrowUp':
          e.preventDefault();
          onVolumeChange?.(0.05);
          break;

        case 'ArrowDown':
          e.preventDefault();
          onVolumeChange?.(-0.05);
          break;

        case 'KeyM':
          e.preventDefault();
          onToggleMute?.();
          break;

        case 'KeyF':
          e.preventDefault();
          onToggleFullscreen?.();
          break;

        case 'KeyC':
          e.preventDefault();
          onToggleSubtitles?.();
          break;

        case 'BracketLeft':
          e.preventDefault();
          onChangeSpeed?.(-0.25);
          break;

        case 'BracketRight':
          e.preventDefault();
          onChangeSpeed?.(0.25);
          break;

        case 'KeyA':
          e.preventDefault();
          onSetABPointA?.();
          break;

        case 'KeyB':
          e.preventDefault();
          onSetABPointB?.();
          break;

        case 'KeyR':
          e.preventDefault();
          onClearABRepeat?.();
          break;

        case 'Escape':
          onEscape?.();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isEnabled,
    seekInterval,
    onTogglePlay,
    onSeek,
    onVolumeChange,
    onToggleMute,
    onToggleFullscreen,
    onToggleSubtitles,
    onChangeSpeed,
    onSetABPointA,
    onSetABPointB,
    onClearABRepeat,
    onEscape,
  ]);
}
