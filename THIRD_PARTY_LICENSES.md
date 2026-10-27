# Third-Party Licenses

CineFlow is a local-first PWA: all media processing happens on your device and
no file content is ever uploaded.

## FFmpeg (WebAssembly) — GPL-2.0-or-later

The on-device conversion engine bundled at `public/ffmpeg/` is
**@ffmpeg/core 0.12.10** (single-threaded build), which is licensed
**GPL-2.0-or-later** because it includes GPL components (libx264).

- Source and exact build configuration: <https://github.com/ffmpegwasm/FFmpeg>
  and <https://ffmpeg.org>
- The wrapper (`@ffmpeg/ffmpeg`, MIT License) is bundled via npm.
- The engine is ~32 MB, loads **lazily** (only when you first start a
  conversion), and is served from this app's own origin — no third-party
  request is made and no media leaves your device.
- Distributing this app with the engine means the combined work is subject to
  GPL-2.0 terms. If that is not acceptable, remove `public/ffmpeg/` and the
  conversion feature degrades gracefully to honest native-playback messages.
- Codec availability in the build is reported truthfully in
  Diagnostics → Local Conversion Engine (actual `-version` / `-encoders` /
  `-decoders` output, not assumptions).

## lamejs — LGPL-3.0

`@breezystack/lamejs` (MP3 encoding for audio exports) is LGPL-3.0 licensed.
Used via npm; source: <https://github.com/zhuker/lamejs>.

## Other dependencies

React, Next.js, Tailwind CSS, lucide-react and the remaining npm dependencies
are MIT/Apache-2.0 licensed — see each package's license file in `node_modules`.
