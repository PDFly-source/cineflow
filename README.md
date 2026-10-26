# CineFlow Advanced Media Player

> **YOUR VIDEOS. YOUR DEVICE. YOUR CONTROL.**

CineFlow is a production-grade, privacy-first, browser-native media player designed with an advanced MX Player-inspired gesture engine, cinema-grade presentation HUD, advanced subtitle studio, and comprehensive client-side controls. Built with Next.js 15 App Router, TypeScript strict mode, Tailwind CSS v4, and browser-native HTML5 video capabilities.

CineFlow operates **100% locally on your machine**: zero cloud uploads, zero background tracking, zero server-side databases, and zero telemetric network requests.

---

## Complete Feature Matrix

### 1. MX Player-Inspired Touch Gesture Engine
- **Dedicated Multi-Touch Engine**: Built on pointer capture and multi-touch tracking (`useVideoGestures` and `VideoGestureSurface`).
- **Left-Side Vertical Gesture (Brightness)**:
  - Swipe up/down on the left 50% of the screen to adjust in-player visual luminance (40% to 160%).
  - Smooth floating animated HUD indicator showing sun icon, percentage, and progress bar.
  - Browser safety guarantee: Visual brightness adjustment applied via GPU-accelerated CSS filter, honoring browser sandbox boundaries.
- **Right-Side Vertical Gesture (Volume)**:
  - Swipe up/down on the right 50% of the screen to adjust volume (0% to 100%).
  - Animated HUD indicator synchronized with native audio control.
  - Runtime detection of browser restrictions (e.g. iOS Safari hardware-only volume limitations).
- **Horizontal Swipe Scrubbing (Seek)**:
  - Swipe left/right horizontally to scrub through media.
  - Shows target timestamp preview, scrub delta (`+15s`, `-30s`), and direction indicator.
  - Clamped safely within `0` and media `duration`.
- **Cumulative Double-Tap Seeking**:
  - Double-tap left zone: jump backward.
  - Double-tap right zone: jump forward.
  - Center double-tap: configurable toggle for Play/Pause.
  - Consecutive taps accumulate dynamically (`-10s`, `-20s`, `-30s`, etc.).
  - Animated ripple waves and feedback badges.
- **Long-Press Speed Boost**:
  - Press and hold anywhere on the video surface to activate temporary 2.0x playback speed.
  - Restores previous playback speed immediately upon release.
- **Two-Finger Pinch-to-Zoom**:
  - Smooth two-finger zoom scaling between 1.0x and 3.0x on video viewport.
  - Double-tap reset action to restore 1.0x native aspect.
- **Interactive Gesture Sandbox**:
  - Live 60fps gesture playground in `/settings` to practice all gestures before viewing videos.
  - Configurable sensitivity presets: `Low`, `Medium`, `High`.

### 2. Advanced Subtitle Studio
- **Format Support**: Local client-side parsing of SubRip (`.srt`) and WebVTT (`.vtt`) subtitle files.
- **Font Styling**: Modern Sans-Serif, Theatrical Serif, Fixed Terminal Mono, and Friendly Rounded.
- **Size Options**: Small, Medium, Large, and Extra-Large.
- **Color Presets**: White, Cinema Yellow, Electric Cyan, and Soft Green.
- **Placement**: Bottom, Middle, and Top vertical positions.
- **Direct Subtitle Gestures**:
  - Drag subtitle cues vertically on screen to adjust height.
  - Swipe horizontally on subtitle cues to nudge audio synchronization offset (`±0.25s`).
- **Fine Audio Sync Offset**:
  - Millisecond precision adjustment stepper buttons (`±50ms`, `±100ms`, `±500ms`, `±1.0s`, `±5.0s`).
- **Live Preview Studio**: Real-time render box inside subtitle modal reflecting styling and opacity.

### 3. Playback Tools & Ergonomics
- **A–B Repeat Loop**:
  - Pinpoint loop start (Point A) and loop end (Point B).
  - Visual loop region highlighted on the scrub timeline with marker pins.
  - Instant toggle and clear buttons.
- **Configurable Seek Intervals**:
  - Rapidly switch between `5s`, `10s`, `15s`, `30s`, and `60s` jump intervals.
- **Sleep Timer**:
  - Timer options: `15m`, `30m`, `45m`, `60m`, `90m`, or custom.
  - Live HUD countdown badge in the top bar.
  - Smooth auto-pause on expiration.
- **Aspect Ratio Fit Modes**:
  - `Contain` (letterboxed widescreen), `Cover` (cropped full), `Fill` (stretched), and `Original 1:1` natural resolution.
- **Playback Speeds**: `0.25x` to `3.0x` variable rate.
- **Queue & Playlist Management**: Reorder items, shuffle, loop track, and loop entire playlist.
- **Picture-in-Picture (PiP)**: Native floating pop-out window.

### 4. Per-Mode Player Profiles
- **Cinema Mode**: Theatrical natural color grading, 1.0x standard speed, sleek 2.5s auto-hide HUD.
- **Lecture / Study Mode**: 1.25x default speed, 5s seek jumps, high-contrast yellow subtitles, quick A–B repeat access.
- **Bedtime Mode**: Warm amber blue-light CSS filter (`sepia(0.22)`), 75% max brightness clamp, and auto sleep timer.

### 5. Playback Capability Diagnostics
- **Dedicated Diagnostics Page & Modal** (`/diagnostics` and inside player):
  - Probes live browser decoders via `HTMLVideoElement.canPlayType` and `MediaSource.isTypeSupported`.
  - Tests H.264 (AVC), H.265 (HEVC Main), VP8, VP9, AV1, AAC, MP3, Opus, FLAC, AC-3 (Dolby Digital), and E-AC-3.
  - Explains why certain MKV/AC-3 files play without audio in browser environments (sandboxed OS licensing).
  - One-click copyable FFmpeg lossless remux recipes (e.g. `ffmpeg -i input.mkv -c:v copy -c:a aac output.mp4`) that convert audio in 5 seconds without re-encoding video.
  - Real error recovery card with diagnostic hints and retry handlers.

### 6. Privacy Dashboard & Granular Local Data Purge
- **Privacy Dashboard** (`/settings`):
  - Storage quota meter showing real IndexedDB usage estimate (`navigator.storage.estimate`).
  - Private Playback Session mode: Incognito shield badge in player; completely suppresses IndexedDB watch history writes during sensitive viewing.
  - Granular deletion options:
    - Clear Playback History Only
    - Clear Saved Subtitles Only
    - Delete All Playlists Only
    - Reset Player Settings to Factory Defaults
    - Full Database Purge
  - Full JSON backup export and import.

### 7. Accessibility & Reduced Motion
- Full compliance with `@media (prefers-reduced-motion: reduce)`: disables transitions and HUD animations when user requests reduced motion.
- Full keyboard shortcut navigation (Space/K, arrows, J/L, M, F, P, C, A, B, R, Esc).

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek backward / forward (configurable 5s–60s) |
| `J` / `L` | Skip backward / forward 10 seconds |
| `↑` / `↓` | Volume up / down (5% increments) |
| `M` | Mute / Unmute audio |
| `F` | Toggle Fullscreen |
| `P` | Toggle Picture-in-Picture (PiP) |
| `C` | Toggle Subtitles |
| `[` / `]` | Decrease / Increase playback speed (±0.25x) |
| `A` | Set A–B Loop Point A |
| `B` | Set A–B Loop Point B |
| `R` | Clear A–B Repeat Loop |
| `Esc` | Exit Fullscreen or dismiss active dialog/drawer |

---

## Technical Architecture

- **No Remote Backend**: CineFlow contains zero server-side database endpoints, zero video storage buckets, and zero analytics trackers.
- **Ephemeral Object URLs**: Selected media files are loaded as temporary in-memory Object URLs (`blob:`) and explicitly revoked (`URL.revokeObjectURL`) when closed or unmounted to prevent memory leaks.
- **Partitioned Local Storage**: Playback timestamps and subtitle associations are stored strictly in client-side `IndexedDB` (`cineflow_db`).
- **Browser Sandboxing & Limitations**:
  - Browsers do not allow web apps unrestricted access to background filesystems across restarts. When resuming a previously watched video, select the video file from your device to re-attach the session.
  - Physical display backlight cannot be modified by standard browser APIs; in-player brightness uses a GPU-accelerated CSS filter overlay.
  - iOS Safari does not support programmatic `HTMLVideoElement.volume` manipulation; hardware volume rockers must be used.

---

## Setup & Testing

### Development
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Automated Unit Tests
```bash
npm test
```
Runs 19 automated unit tests verifying gesture calculations, subtitle parsers, A-B repeat logic, diagnostics engine, and formatters.

### Linting
```bash
npm run lint
```

### Production Build
```bash
npm run build
npm run start
```
