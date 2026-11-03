# CineFlow v0.2.3

## New official brand identity
- **Full lockup adopted** on the launch screen and the About surface: the
  film-strip "C" with its play mark, the Cineflow wordmark, and the
  **PRIVATE · CINEMA · CONTROL** tagline, in one composition taken from the
  supplied official artwork. Nothing is cropped, stretched or recoloured.
- The lockup is shown on a white card so the deep-navy parts of the mark keep
  their contrast against the app's dark surfaces, with a width cap of
  `min(78vw, 300px)` so the tagline keeps a safe margin on narrow Android
  viewports and never touches a screen edge.
- **App icon rebuilt from the mark alone.** Launcher, PWA (192/512), maskable,
  Apple touch icon and favicon are generated from the symbol — no wordmark or
  tagline squeezed into a 48px tile. The mark sits inside Android's
  adaptive-icon safe zone, so circular, squircle and rounded-square masks all
  keep it whole and centred.
- The header wordmark stays text-based on purpose: at header size the official
  lockup's tagline would be illegible, and the text wordmark already carries the
  brand gradient.
- No functional change: playback, library, playlists, subtitles, MP3 conversion,
  device-to-device transfer and local-first storage are untouched.

---

# CineFlow v0.2.2

## Player layout aligned with the reference player
- Timestamps now sit at the two ends of the scrubber (current | bar | total)
  instead of a slash-joined pair above it. One source of truth, no duplicate row.
- **Restore** control above the centre cluster resets zoom and picture rotation
  only. It never pauses, seeks or reloads the media.
- Centre cluster (skip back, play/pause, skip forward) enlarged for one-thumb use.
- **Rotation moved into the bottom icon bar**, next to a new aspect-ratio cycle
  (contain, cover, fill, original, crop). One tap requests landscape through the
  native bridge, with the v0.2.1 sensor-landscape and lock-release fixes behind it.

## Unchanged
Premium dark theme, purple/blue accents, IndexedDB local-first storage, resume
progress, Subtitle Studio (no X button, player navigation stays visible), local
audio EQ, queue, gestures.

## Known limits
No physical Android device was available for this build, so launcher-icon
persistence and real-device rotation remain unverified here.
