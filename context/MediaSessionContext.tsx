'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  PlaybackRecord,
  savePlaybackRecord,
  getPlaybackRecord,
  getSettings,
  saveSettings,
  UserSettings,
  DEFAULT_SETTINGS,
  getMediaKey,
  VideoFitMode,
  PlayerProfile,
  getSubtitleRecord,
  saveSubtitleRecord,
  toggleFavoriteRecord,
} from '@/lib/storage/db';
import { parseSubtitleFile, ParsedSubtitle } from '@/lib/subtitles/parser';

export interface ActiveMediaItem {
  id: string; // mediaKey
  file: File;
  objectUrl: string;
  name: string;
  size: number;
  lastModified: number;
  duration?: number;
}

export type LoopMode = 'none' | 'one' | 'all';

export interface ABRepeatState {
  pointA: number | null;
  pointB: number | null;
  isActive: boolean;
}

interface MediaContextType {
  // Playlist / Queue
  queue: ActiveMediaItem[];
  currentIndex: number;
  currentItem: ActiveMediaItem | null;
  selectFiles: (files: File[], startIndex?: number) => void;
  appendFiles: (files: File[]) => void;
  playIndex: (index: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  removeQueueItem: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  shuffleQueue: () => void;

  // Playback Modes
  loopMode: LoopMode;
  setLoopMode: (mode: LoopMode) => void;
  fitMode: VideoFitMode;
  setFitMode: (mode: VideoFitMode) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;

  // A-B Repeat Loop
  abRepeat: ABRepeatState;
  setABPointA: (time: number) => void;
  setABPointB: (time: number) => void;
  clearABRepeat: () => void;
  toggleABRepeat: () => void;

  // Sleep Timer
  sleepTimerMinutes: number | null;
  sleepTimerRemainingSeconds: number | null;
  setSleepTimer: (minutes: number | null) => void;

  // Private Session
  isPrivateSession: boolean;
  setIsPrivateSession: (isPrivate: boolean) => void;

  // Favorites
  isCurrentFavorite: boolean;
  toggleFavorite: () => Promise<boolean>;

  // Player Profile
  playerProfile: PlayerProfile;
  setPlayerProfile: (profile: PlayerProfile) => void;

  // Subtitles
  activeSubtitle: ParsedSubtitle | null;
  subtitleEnabled: boolean;
  setSubtitleEnabled: (enabled: boolean) => void;
  loadSubtitleFile: (file: File) => Promise<boolean>;
  setSubtitleOffset: (offsetSeconds: number) => void;
  clearSubtitle: () => void;

  // Settings
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;

  // Resume Progress
  savedProgress: PlaybackRecord | null;
  recordProgress: (currentTime: number, duration: number) => Promise<void>;
  markWatched: (mediaKey: string) => Promise<void>;
  clearSavedProgress: () => void;
}

const MediaContext = createContext<MediaContextType | null>(null);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<ActiveMediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [loopMode, setLoopMode] = useState<LoopMode>('none');
  const [fitMode, setFitMode] = useState<VideoFitMode>('contain');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [settings, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS);

  const [activeSubtitle, setActiveSubtitle] = useState<ParsedSubtitle | null>(null);
  const [subtitleEnabled, setSubtitleEnabled] = useState<boolean>(true);
  const [savedProgress, setSavedProgress] = useState<PlaybackRecord | null>(null);

  // A-B Repeat Loop
  const [abRepeat, setAbRepeat] = useState<ABRepeatState>({
    pointA: null,
    pointB: null,
    isActive: false,
  });

  // Sleep Timer
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState<number | null>(null);
  const sleepTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Private Playback Session
  const [isPrivateSession, setIsPrivateSession] = useState<boolean>(false);

  // Favorite status of current item
  const [isCurrentFavorite, setIsCurrentFavorite] = useState<boolean>(false);

  // Player Profile
  const [playerProfile, setPlayerProfileState] = useState<PlayerProfile>('movie');

  // Keep track of all object URLs created to revoke them properly
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Load user settings on mount
  useEffect(() => {
    getSettings().then((s) => {
      setSettingsState(s);
      setFitMode(s.defaultFit || 'contain');
      setPlaybackSpeed(s.defaultSpeed || 1.0);
      setPlayerProfileState(s.playerProfile || 'movie');
    });
  }, []);

  // Sleep Timer countdown management
  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }

    if (minutes === null) {
      setSleepTimerRemainingSeconds(null);
    } else {
      const initialSeconds = minutes * 60;
      setSleepTimerRemainingSeconds(initialSeconds);
      sleepTimerIntervalRef.current = setInterval(() => {
        setSleepTimerRemainingSeconds((prev) => {
          if (prev === null || prev <= 1) {
            if (sleepTimerIntervalRef.current) {
              clearInterval(sleepTimerIntervalRef.current);
              sleepTimerIntervalRef.current = null;
            }
            setSleepTimerMinutes(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (sleepTimerIntervalRef.current) {
        clearInterval(sleepTimerIntervalRef.current);
      }
    };
  }, []);

  // Cleanup object URLs when window is unloaded
  useEffect(() => {
    const handleBeforeUnload = () => {
      objectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      objectUrlsRef.current.clear();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const createItem = useCallback((file: File): ActiveMediaItem => {
    const objectUrl = URL.createObjectURL(file);
    objectUrlsRef.current.add(objectUrl);
    return {
      id: getMediaKey(file),
      file,
      objectUrl,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
    };
  }, []);

  // Cleanup a single item's URL
  const releaseItemUrl = useCallback((item: ActiveMediaItem) => {
    if (item.objectUrl) {
      try {
        URL.revokeObjectURL(item.objectUrl);
        objectUrlsRef.current.delete(item.objectUrl);
      } catch {}
    }
  }, []);

  const selectFiles = useCallback((files: File[], startIndex = 0) => {
    if (!files.length) return;

    // Reset A-B repeat
    setAbRepeat({ pointA: null, pointB: null, isActive: false });

    // Clear subtitle
    setActiveSubtitle((prev) => {
      if (prev?.vttBlobUrl) {
        try {
          URL.revokeObjectURL(prev.vttBlobUrl);
        } catch {}
      }
      return null;
    });

    const newItems = files.map(createItem);
    setQueue(newItems);
    const validStart = Math.min(Math.max(0, startIndex), newItems.length - 1);
    setCurrentIndex(validStart);
  }, [createItem]);

  const appendFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    const newItems = files.map(createItem);
    setQueue((prev) => {
      const next = [...prev, ...newItems];
      if (prev.length === 0) {
        setCurrentIndex(0);
      }
      return next;
    });
  }, [createItem]);

  const playIndex = useCallback((index: number) => {
    if (index >= 0 && index < queue.length) {
      setAbRepeat({ pointA: null, pointB: null, isActive: false });
      setCurrentIndex(index);
    }
  }, [queue.length]);

  const currentItem = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  useEffect(() => {
    let isSubscribed = true;

    if (!currentItem) {
      queueMicrotask(() => {
        if (isSubscribed) {
          setSavedProgress(null);
          setIsCurrentFavorite(false);
        }
      });
      return () => {
        isSubscribed = false;
      };
    }

    // Load saved progress & favorite
    getPlaybackRecord(currentItem.id).then((rec) => {
      if (isSubscribed) {
        setSavedProgress(rec);
        setIsCurrentFavorite(rec?.isFavorite ?? false);
      }
    });

    // Check if there is an associated subtitle saved for this video
    getSubtitleRecord(currentItem.id).then((subRec) => {
      if (isSubscribed && subRec) {
        const parsed = parseSubtitleFile(subRec.rawText, subRec.fileName, subRec.offsetSeconds);
        setActiveSubtitle(parsed);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [currentItem]);

  const nextTrack = useCallback(() => {
    if (!queue.length) return;
    setAbRepeat({ pointA: null, pointB: null, isActive: false });
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (loopMode === 'all') {
      setCurrentIndex(0);
    }
  }, [queue.length, currentIndex, loopMode]);

  const prevTrack = useCallback(() => {
    if (!queue.length) return;
    setAbRepeat({ pointA: null, pointB: null, isActive: false });
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else if (loopMode === 'all') {
      setCurrentIndex(queue.length - 1);
    }
  }, [queue.length, currentIndex, loopMode]);

  const removeQueueItem = useCallback((index: number) => {
    setQueue((prev) => {
      const target = prev[index];
      if (target) releaseItemUrl(target);
      const next = prev.filter((_, i) => i !== index);

      if (index === currentIndex) {
        if (next.length === 0) {
          setCurrentIndex(-1);
        } else if (index >= next.length) {
          setCurrentIndex(next.length - 1);
        }
      } else if (index < currentIndex) {
        setCurrentIndex((curr) => curr - 1);
      }

      return next;
    });
  }, [currentIndex, releaseItemUrl]);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      if (currentIndex === fromIndex) {
        setCurrentIndex(toIndex);
      } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
        setCurrentIndex((c) => c - 1);
      } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
        setCurrentIndex((c) => c + 1);
      }

      return updated;
    });
  }, [currentIndex]);

  const clearQueue = useCallback(() => {
    queue.forEach(releaseItemUrl);
    setQueue([]);
    setCurrentIndex(-1);
    setAbRepeat({ pointA: null, pointB: null, isActive: false });
    setActiveSubtitle((prev) => {
      if (prev?.vttBlobUrl) URL.revokeObjectURL(prev.vttBlobUrl);
      return null;
    });
    setSavedProgress(null);
  }, [queue, releaseItemUrl]);

  const shuffleQueue = useCallback(() => {
    if (queue.length <= 1) return;
    setQueue((prev) => {
      const current = prev[currentIndex];
      const others = prev.filter((_, i) => i !== currentIndex);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      const reshuffled = current ? [current, ...others] : others;
      setCurrentIndex(0);
      return reshuffled;
    });
  }, [queue.length, currentIndex]);

  // A-B Repeat methods
  const setABPointA = useCallback((time: number) => {
    setAbRepeat((prev) => {
      const newA = Math.max(0, time);
      const newB = prev.pointB !== null && prev.pointB > newA ? prev.pointB : null;
      return {
        pointA: newA,
        pointB: newB,
        isActive: newB !== null,
      };
    });
  }, []);

  const setABPointB = useCallback((time: number) => {
    setAbRepeat((prev) => {
      if (prev.pointA === null) {
        return { pointA: 0, pointB: time, isActive: true };
      }
      if (time <= prev.pointA) return prev;
      return {
        pointA: prev.pointA,
        pointB: time,
        isActive: true,
      };
    });
  }, []);

  const clearABRepeat = useCallback(() => {
    setAbRepeat({ pointA: null, pointB: null, isActive: false });
  }, []);

  const toggleABRepeat = useCallback(() => {
    setAbRepeat((prev) => {
      if (prev.pointA === null || prev.pointB === null) return prev;
      return { ...prev, isActive: !prev.isActive };
    });
  }, []);

  // Favorite toggle
  const toggleFavorite = useCallback(async (): Promise<boolean> => {
    if (!currentItem) return false;
    const nextFav = await toggleFavoriteRecord(currentItem.id);
    setIsCurrentFavorite(nextFav);
    return nextFav;
  }, [currentItem]);

  // Settings update
  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  }, []);

  // Player Profile preset switcher
  const setPlayerProfile = useCallback(
    (profile: PlayerProfile) => {
      setPlayerProfileState(profile);
      if (profile === 'movie') {
        setFitMode('contain');
        setPlaybackSpeed(1.0);
        updateSettings({
          playerProfile: 'movie',
          autoHideDelay: 2500,
          subtitleColor: '#ffffff',
          subtitleSize: 'medium',
        });
      } else if (profile === 'lecture') {
        setFitMode('contain');
        setPlaybackSpeed(1.25);
        updateSettings({
          playerProfile: 'lecture',
          seekInterval: 5,
          subtitleColor: '#fef08a',
          subtitleSize: 'large',
        });
      } else if (profile === 'bedtime') {
        setPlaybackSpeed(1.0);
        updateSettings({
          playerProfile: 'bedtime',
          autoHideDelay: 4500,
          subtitleColor: '#a7f3d0',
        });
        // Suggest 30 minute sleep timer
        setSleepTimer(30);
      }
    },
    [setSleepTimer, updateSettings]
  );

  // Subtitle handler
  const loadSubtitleFile = useCallback(async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const parsed = parseSubtitleFile(text, file.name, 0);

      // Revoke prior subtitle URL
      setActiveSubtitle((prev) => {
        if (prev?.vttBlobUrl) URL.revokeObjectURL(prev.vttBlobUrl);
        return parsed;
      });
      setSubtitleEnabled(true);

      // Save association in IndexedDB if currentItem exists and not in private session
      if (currentItem && !isPrivateSession) {
        await saveSubtitleRecord({
          id: currentItem.id,
          fileName: file.name,
          format: parsed.format,
          rawText: text,
          offsetSeconds: 0,
          updatedAt: Date.now(),
        });
      }

      return true;
    } catch (err) {
      console.error('Failed to parse subtitle:', err);
      return false;
    }
  }, [currentItem, isPrivateSession]);

  const setSubtitleOffset = useCallback((offsetSeconds: number) => {
    setActiveSubtitle((prev) => {
      if (!prev) return null;
      if (prev.vttBlobUrl) URL.revokeObjectURL(prev.vttBlobUrl);
      return parseSubtitleFile(prev.originalText, 'subtitle.' + prev.format, offsetSeconds);
    });
  }, []);

  const clearSubtitle = useCallback(() => {
    setActiveSubtitle((prev) => {
      if (prev?.vttBlobUrl) URL.revokeObjectURL(prev.vttBlobUrl);
      return null;
    });
    if (currentItem && !isPrivateSession) {
      import('@/lib/storage/db').then((mod) => mod.deleteSubtitleRecord(currentItem.id));
    }
  }, [currentItem, isPrivateSession]);

  // Save playback progress
  const recordProgress = useCallback(async (currentTime: number, duration: number) => {
    // If in private session or disabled, skip persistence entirely
    if (isPrivateSession || !currentItem || !settings.saveHistory || duration <= 0) return;

    const completed = currentTime >= duration - 5;
    const progressPercent = Math.min(100, Math.round((currentTime / duration) * 100));

    const record: PlaybackRecord = {
      id: currentItem.id,
      fileName: currentItem.name,
      fileSize: currentItem.size,
      lastModified: currentItem.lastModified,
      duration,
      currentTime,
      progressPercent,
      completed,
      lastPlayedAt: Date.now(),
      subtitleName: activeSubtitle ? 'active' : undefined,
      isFavorite: isCurrentFavorite,
    };

    await savePlaybackRecord(record);
    setSavedProgress(record);
  }, [currentItem, settings.saveHistory, activeSubtitle, isPrivateSession, isCurrentFavorite]);

  const markWatched = useCallback(async (mediaKey: string) => {
    if (isPrivateSession) return;
    const rec = await getPlaybackRecord(mediaKey);
    if (rec) {
      rec.completed = true;
      rec.progressPercent = 100;
      rec.currentTime = rec.duration;
      await savePlaybackRecord(rec);
      if (currentItem && currentItem.id === mediaKey) {
        setSavedProgress(rec);
      }
    }
  }, [currentItem, isPrivateSession]);

  const clearSavedProgress = useCallback(() => {
    setSavedProgress(null);
  }, []);

  return (
    <MediaContext.Provider
      value={{
        queue,
        currentIndex,
        currentItem,
        selectFiles,
        appendFiles,
        playIndex,
        nextTrack,
        prevTrack,
        removeQueueItem,
        reorderQueue,
        clearQueue,
        shuffleQueue,
        loopMode,
        setLoopMode,
        fitMode,
        setFitMode,
        playbackSpeed,
        setPlaybackSpeed,
        abRepeat,
        setABPointA,
        setABPointB,
        clearABRepeat,
        toggleABRepeat,
        sleepTimerMinutes,
        sleepTimerRemainingSeconds,
        setSleepTimer,
        isPrivateSession,
        setIsPrivateSession,
        isCurrentFavorite,
        toggleFavorite,
        playerProfile,
        setPlayerProfile,
        activeSubtitle,
        subtitleEnabled,
        setSubtitleEnabled,
        loadSubtitleFile,
        setSubtitleOffset,
        clearSubtitle,
        settings,
        updateSettings,
        savedProgress,
        recordProgress,
        markWatched,
        clearSavedProgress,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export function useMedia(): MediaContextType {
  const ctx = useContext(MediaContext);
  if (!ctx) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return ctx;
}
