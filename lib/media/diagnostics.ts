/**
 * Comprehensive Browser Media Capability Diagnostics Engine
 * Tests HTML5 video and audio codec support via canPlayType and MediaSource.isTypeSupported
 */

export interface CodecTestResult {
  id: string;
  name: string;
  mimeType: string;
  category: 'container' | 'video' | 'audio';
  canPlayResult: 'probably' | 'maybe' | '';
  mseSupported: boolean;
  status: 'supported' | 'partial' | 'unsupported';
  description: string;
  solution?: string;
}

export interface SystemCapability {
  name: string;
  supported: boolean;
  notes: string;
}

export interface DiagnosticsReport {
  timestamp: string;
  userAgent: string;
  results: CodecTestResult[];
  systemCapabilities: SystemCapability[];
  supportedCount: number;
  unsupportedCount: number;
}

const TEST_FORMATS: Array<{
  id: string;
  name: string;
  mimeType: string;
  category: 'container' | 'video' | 'audio';
  description: string;
  solution?: string;
}> = [
  {
    id: 'mp4-avc',
    name: 'MP4 / H.264 (AVC)',
    mimeType: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    category: 'video',
    description: 'The universal web standard. Supported on virtually 100% of browsers and mobile devices.',
  },
  {
    id: 'mp4-hevc',
    name: 'MP4 / H.265 (HEVC Main)',
    mimeType: 'video/mp4; codecs="hvc1.1.6.L93.B0"',
    category: 'video',
    description: 'High efficiency 4K/HDR codec. Requires hardware GPU licensing. Supported on Safari (macOS/iOS) and Windows Edge with HEVC extension, but not standard Chrome/Firefox on Linux.',
    solution: 'ffmpeg -i input.mkv -c:v libx264 -crf 20 -c:a aac output.mp4',
  },
  {
    id: 'webm-vp8',
    name: 'WebM / VP8',
    mimeType: 'video/webm; codecs="vp8, vorbis"',
    category: 'video',
    description: 'Open-source legacy web codec supported across modern browsers.',
  },
  {
    id: 'webm-vp9',
    name: 'WebM / VP9',
    mimeType: 'video/webm; codecs="vp9, opus"',
    category: 'video',
    description: 'Next-generation open video format developed for YouTube and streaming.',
  },
  {
    id: 'mp4-av1',
    name: 'MP4 / AV1',
    mimeType: 'video/mp4; codecs="av01.0.05M.08"',
    category: 'video',
    description: 'Royalty-free next-gen codec with superior compression. Requires modern browser and CPU/GPU decode support.',
  },
  {
    id: 'audio-aac',
    name: 'AAC Audio (Advanced Audio Coding)',
    mimeType: 'audio/mp4; codecs="mp4a.40.2"',
    category: 'audio',
    description: 'Universal standard audio format across all web browsers and mobile platforms.',
  },
  {
    id: 'audio-opus',
    name: 'Opus Audio',
    mimeType: 'audio/webm; codecs="opus"',
    category: 'audio',
    description: 'Low-latency, high-fidelity open audio codec widely supported in modern browsers.',
  },
  {
    id: 'audio-mp3',
    name: 'MP3 Audio (MPEG Audio Layer III)',
    mimeType: 'audio/mpeg',
    category: 'audio',
    description: 'Legacy audio format supported natively by all web browsers.',
  },
  {
    id: 'audio-flac',
    name: 'FLAC (Free Lossless Audio Codec)',
    mimeType: 'audio/flac',
    category: 'audio',
    description: 'Lossless audio codec supported on modern Chrome, Firefox, Safari, and Edge.',
  },
  {
    id: 'audio-ac3',
    name: 'Dolby Digital AC-3 Audio',
    mimeType: 'audio/mp4; codecs="ac-3"',
    category: 'audio',
    description: 'Common in TV & movie rips. Browsers without Dolby OS decoders (most desktop Chrome/Firefox) will play video silently.',
    solution: 'Remux audio to AAC without re-encoding video: ffmpeg -i input.mkv -c:v copy -c:a aac -b:a 192k output.mp4',
  },
  {
    id: 'audio-eac3',
    name: 'Dolby Digital Plus (E-AC-3)',
    mimeType: 'audio/mp4; codecs="ec-3"',
    category: 'audio',
    description: 'Streaming Dolby format. Requires platform-level bitstream pass-through (Safari / Edge on supported OS).',
    solution: 'ffmpeg -i input.mkv -c:v copy -c:a aac -b:a 256k output.mp4',
  },
  {
    id: 'container-mkv',
    name: 'Matroska Video Container (MKV)',
    mimeType: 'video/x-matroska',
    category: 'container',
    description: 'Powerful multimedia container. Chrome & Safari support MKV container parsing if the underlying tracks are H.264/AAC or VP9/Opus, but fail if streams are DTS/AC-3.',
    solution: 'Fast Remux (< 15 seconds): ffmpeg -i input.mkv -c:v copy -c:a aac output.mp4',
  },
];

export function runPlaybackDiagnostics(): DiagnosticsReport {
  if (typeof window === 'undefined') {
    return {
      timestamp: new Date().toISOString(),
      userAgent: 'Server-Side Execution',
      results: [],
      systemCapabilities: [],
      supportedCount: 0,
      unsupportedCount: 0,
    };
  }

  const dummyVideo = document.createElement('video');
  const hasMSE = 'MediaSource' in window;

  const results: CodecTestResult[] = TEST_FORMATS.map((f) => {
    let canPlay = '';
    try {
      canPlay = dummyVideo.canPlayType(f.mimeType);
    } catch {
      canPlay = '';
    }

    let mseSupported = false;
    if (hasMSE) {
      try {
        mseSupported = MediaSource.isTypeSupported(f.mimeType);
      } catch {
        mseSupported = false;
      }
    }

    let status: 'supported' | 'partial' | 'unsupported' = 'unsupported';
    if (canPlay === 'probably' || mseSupported) {
      status = 'supported';
    } else if (canPlay === 'maybe') {
      status = 'partial';
    } else {
      status = 'unsupported';
    }

    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      category: f.category,
      canPlayResult: canPlay as 'probably' | 'maybe' | '',
      mseSupported,
      status,
      description: f.description,
      solution: f.solution,
    };
  });

  const systemCapabilities: SystemCapability[] = [
    {
      name: 'Picture-in-Picture (PiP)',
      supported: typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && !!document.pictureInPictureEnabled,
      notes: 'Allows popping video out into a floating window over other applications.',
    },
    {
      name: 'Media Session API',
      supported: typeof navigator !== 'undefined' && 'mediaSession' in navigator,
      notes: 'Integrates with system lock screen, smartwatch, and bluetooth audio controls.',
    },
    {
      name: 'Screen Wake Lock API',
      supported: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
      notes: 'Prevents display sleep during active playback when permitted.',
    },
    {
      name: 'Haptic Feedback (Vibration API)',
      supported: typeof navigator !== 'undefined' && 'vibrate' in navigator,
      notes: 'Provides tactile tick feedback during gesture snaps and adjustments.',
    },
    {
      name: 'Fullscreen API',
      supported: typeof document !== 'undefined' && (document.fullscreenEnabled || (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled || false),
      notes: 'Allows full viewport immersion without browser chrome.',
    },
    {
      name: 'Client-Side IndexedDB Storage',
      supported: typeof window !== 'undefined' && !!window.indexedDB,
      notes: 'Enables private, local-only playback resumes without cloud servers.',
    },
  ];

  const supportedCount = results.filter((r) => r.status === 'supported').length;
  const unsupportedCount = results.filter((r) => r.status === 'unsupported').length;

  return {
    timestamp: new Date().toLocaleTimeString(),
    userAgent: navigator.userAgent,
    results,
    systemCapabilities,
    supportedCount,
    unsupportedCount,
  };
}
