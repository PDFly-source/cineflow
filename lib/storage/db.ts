export interface PlaybackRecord {
  id: string; // mediaKey: `${name}_${size}_${lastModified}`
  fileName: string;
  fileSize: number;
  lastModified: number;
  duration: number;
  currentTime: number;
  progressPercent: number;
  completed: boolean;
  lastPlayedAt: number;
  subtitleName?: string;
  subtitleOffset?: number;
  isFavorite?: boolean;
}

export interface PlaylistItemRef {
  name: string;
  size: number;
  lastModified: number;
  duration?: number;
}

export interface PlaylistRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: PlaylistItemRef[];
}

export interface SavedSubtitleRecord {
  id: string; // mediaKey
  fileName: string;
  format: 'srt' | 'vtt';
  rawText: string;
  offsetSeconds: number;
  updatedAt: number;
}

export type SubtitleSize = 'small' | 'medium' | 'large' | 'extra-large';
export type SubtitleFont = 'sans' | 'serif' | 'mono' | 'rounded';
export type SubtitlePosition = 'bottom' | 'top' | 'middle';
export type VideoFitMode = 'contain' | 'cover' | 'fill' | 'original';
export type PlayerProfile = 'movie' | 'lecture' | 'bedtime';

export type GestureSensitivity = 'low' | 'medium' | 'high';
export type CenterDoubleTapAction = 'play_pause' | 'none';

export interface UserSettings {
  theme: 'dark' | 'light';
  accentColor: 'cyan' | 'violet' | 'emerald';
  defaultSpeed: number;
  seekInterval: number;
  gesturesEnabled: boolean;
  horizontalSeekGesture: boolean;
  doubleTapGesture: boolean;
  brightnessGesture: boolean;
  volumeGesture: boolean;
  longPressBoostGesture: boolean;
  longPressSpeed: number;
  pinchZoomGesture: boolean;
  centerDoubleTapAction: CenterDoubleTapAction;
  gestureSensitivity: GestureSensitivity;
  hapticFeedback: boolean;
  defaultFit: VideoFitMode;
  resumePlayback: boolean;
  saveHistory: boolean;
  autoHideDelay: number;
  subtitleSize: SubtitleSize;
  subtitleFont: SubtitleFont;
  subtitlePosition: SubtitlePosition;
  subtitleColor: string;
  subtitleBgOpacity: number;
  subtitleBottomOffset: number;
  subtitleTextShadow: boolean;
  playerProfile: PlayerProfile;
  confirmBeforeClearing: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  accentColor: 'cyan',
  defaultSpeed: 1.0,
  seekInterval: 10,
  gesturesEnabled: true,
  horizontalSeekGesture: true,
  doubleTapGesture: true,
  brightnessGesture: true,
  volumeGesture: true,
  longPressBoostGesture: true,
  longPressSpeed: 2.0,
  pinchZoomGesture: true,
  centerDoubleTapAction: 'play_pause',
  gestureSensitivity: 'medium',
  hapticFeedback: true,
  defaultFit: 'contain',
  resumePlayback: true,
  saveHistory: true,
  autoHideDelay: 3500,
  subtitleSize: 'medium',
  subtitleFont: 'sans',
  subtitlePosition: 'bottom',
  subtitleColor: '#ffffff',
  subtitleBgOpacity: 0.65,
  subtitleBottomOffset: 48,
  subtitleTextShadow: true,
  playerProfile: 'movie',
  confirmBeforeClearing: true,
};

const DB_NAME = 'cineflow_db';
const DB_VERSION = 1;
const STORES = {
  HISTORY: 'playback_history',
  PLAYLISTS: 'playlists',
  SUBTITLES: 'saved_subtitles',
  SETTINGS: 'user_settings',
} as const;

export function getMediaKey(file: { name: string; size: number; lastModified: number }): string {
  return `${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}_${file.size}_${file.lastModified}`;
}

// In-memory fallback if IndexedDB is disabled (e.g. strict private mode)
const memoryFallback = {
  history: new Map<string, PlaybackRecord>(),
  playlists: new Map<string, PlaylistRecord>(),
  subtitles: new Map<string, SavedSubtitleRecord>(),
  settings: { ...DEFAULT_SETTINGS },
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.HISTORY)) {
        const histStore = db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
        histStore.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
        histStore.createIndex('completed', 'completed', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
        const plStore = db.createObjectStore(STORES.PLAYLISTS, { keyPath: 'id' });
        plStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SUBTITLES)) {
        db.createObjectStore(STORES.SUBTITLES, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

// ================= HISTORY OPERATIONS =================

export async function savePlaybackRecord(record: PlaybackRecord): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readwrite');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.history.set(record.id, record);
    try {
      localStorage.setItem(`cf_hist_${record.id}`, JSON.stringify(record));
    } catch {
      // Ignore quota error
    }
  }
}

export async function getPlaybackRecord(mediaKey: string): Promise<PlaybackRecord | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readonly');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.get(mediaKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const mem = memoryFallback.history.get(mediaKey);
    if (mem) return mem;
    try {
      const raw = localStorage.getItem(`cf_hist_${mediaKey}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export async function getAllPlaybackRecords(): Promise<PlaybackRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readonly');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.getAll();
      req.onsuccess = () => {
        const results: PlaybackRecord[] = req.result || [];
        results.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = Array.from(memoryFallback.history.values());
    list.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
    return list;
  }
}

export async function deletePlaybackRecord(mediaKey: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readwrite');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.delete(mediaKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.history.delete(mediaKey);
    try {
      localStorage.removeItem(`cf_hist_${mediaKey}`);
    } catch {}
  }
}

export async function clearAllPlaybackRecords(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.HISTORY, 'readwrite');
      const store = tx.objectStore(STORES.HISTORY);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.history.clear();
  }
}

export async function toggleFavoriteRecord(mediaKey: string): Promise<boolean> {
  const record = await getPlaybackRecord(mediaKey);
  if (!record) return false;
  const nextFav = !record.isFavorite;
  record.isFavorite = nextFav;
  await savePlaybackRecord(record);
  return nextFav;
}

export async function getFavoriteRecords(): Promise<PlaybackRecord[]> {
  const all = await getAllPlaybackRecords();
  return all.filter((r) => r.isFavorite === true);
}

// ================= PLAYLIST OPERATIONS =================

export async function savePlaylist(playlist: PlaylistRecord): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PLAYLISTS, 'readwrite');
      const store = tx.objectStore(STORES.PLAYLISTS);
      const req = store.put(playlist);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.playlists.set(playlist.id, playlist);
  }
}

export async function getAllPlaylists(): Promise<PlaylistRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PLAYLISTS, 'readonly');
      const store = tx.objectStore(STORES.PLAYLISTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const results: PlaylistRecord[] = req.result || [];
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list = Array.from(memoryFallback.playlists.values());
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }
}

export async function deletePlaylist(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PLAYLISTS, 'readwrite');
      const store = tx.objectStore(STORES.PLAYLISTS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.playlists.delete(id);
  }
}

// ================= SUBTITLE OPERATIONS =================

export async function saveSubtitleRecord(sub: SavedSubtitleRecord): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SUBTITLES, 'readwrite');
      const store = tx.objectStore(STORES.SUBTITLES);
      const req = store.put(sub);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.subtitles.set(sub.id, sub);
  }
}

export async function getSubtitleRecord(mediaKey: string): Promise<SavedSubtitleRecord | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SUBTITLES, 'readonly');
      const store = tx.objectStore(STORES.SUBTITLES);
      const req = store.get(mediaKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memoryFallback.subtitles.get(mediaKey) || null;
  }
}

export async function deleteSubtitleRecord(mediaKey: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SUBTITLES, 'readwrite');
      const store = tx.objectStore(STORES.SUBTITLES);
      const req = store.delete(mediaKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.subtitles.delete(mediaKey);
  }
}

export async function clearAllSubtitles(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SUBTITLES, 'readwrite');
      const store = tx.objectStore(STORES.SUBTITLES);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.subtitles.clear();
  }
}

export async function clearAllPlaylists(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PLAYLISTS, 'readwrite');
      const store = tx.objectStore(STORES.PLAYLISTS);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback.playlists.clear();
  }
}

export async function resetSettingsToDefault(): Promise<UserSettings> {
  await saveSettings(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

// ================= SETTINGS OPERATIONS =================

export async function getSettings(): Promise<UserSettings> {
  try {
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem('cf_user_settings');
      if (local) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      }
    }
  } catch {}
  return memoryFallback.settings;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  memoryFallback.settings = { ...settings };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('cf_user_settings', JSON.stringify(settings));
    } catch {}
  }
}

// ================= STORAGE QUOTA & BACKUP =================

export interface StorageEstimateResult {
  usageBytes: number;
  quotaBytes: number;
  percentageUsed: number;
  isAvailable: boolean;
}

export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;
      return {
        usageBytes: usage,
        quotaBytes: quota,
        percentageUsed: Number(percentage.toFixed(2)),
        isAvailable: true,
      };
    } catch {
      // Fallback
    }
  }
  return {
    usageBytes: 0,
    quotaBytes: 0,
    percentageUsed: 0,
    isAvailable: false,
  };
}

export async function exportAllData(): Promise<string> {
  const [history, playlists, settings] = await Promise.all([
    getAllPlaybackRecords(),
    getAllPlaylists(),
    getSettings(),
  ]);

  const backup = {
    app: 'CineFlow',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    settings,
    history,
    playlists,
  };

  return JSON.stringify(backup, null, 2);
}

export async function importData(jsonString: string): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON structure.');
    }
    if (data.app && data.app !== 'CineFlow') {
      throw new Error('File is not a valid CineFlow backup.');
    }

    let importedCount = 0;

    if (data.settings && typeof data.settings === 'object') {
      await saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      importedCount++;
    }

    if (Array.isArray(data.history)) {
      for (const item of data.history) {
        if (item.id && item.fileName) {
          await savePlaybackRecord(item);
          importedCount++;
        }
      }
    }

    if (Array.isArray(data.playlists)) {
      for (const pl of data.playlists) {
        if (pl.id && pl.name && Array.isArray(pl.items)) {
          await savePlaylist(pl);
          importedCount++;
        }
      }
    }

    return {
      success: true,
      message: `Successfully imported ${importedCount} items.`,
      count: importedCount,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown parsing error';
    return {
      success: false,
      message: `Import failed: ${msg}`,
      count: 0,
    };
  }
}

export async function clearAllLocalData(): Promise<void> {
  try {
    await clearAllPlaybackRecords();
    const playlists = await getAllPlaylists();
    for (const pl of playlists) {
      await deletePlaylist(pl.id);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cf_user_settings');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('cf_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch {}
}
