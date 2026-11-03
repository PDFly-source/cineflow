# CineFlow v0.2.5

## Launcher icon rebuilt so the brand actually survives Android's launcher
0.2.4 shipped the complete lockup inside the APK and still looked like the symbol
alone on a phone. That was a real failure, and this release fixes the cause.

- **Root cause.** The lockup is a three-element stack: symbol, a 5.4:1 wordmark and
  a 37:1 single-line tagline. Android's adaptive icon only guarantees the central
  66/108 circle, so the builder fitted the whole stack's diagonal into that circle:
  the artwork ended up occupying 41.7% of the tile and the tagline rendered about
  1.3px at a 144px launcher tile. Present in the file, invisible on the device.
- **Fix.** The launcher icon is now a purpose-built composition, built from the
  approved artwork's own pixels by `scripts/build_launcher_icon.py`. Nothing is
  redrawn: the symbol, the wordmark and the three tagline words are cropped out of
  `cineflow-icon-lockup-512.png` and re-laid so the tagline stacks one word per
  line, which turns a 37:1 line into three ~7:1 lines.
- **Measured result at launcher size,** adaptive icon: symbol 14.1px, wordmark
  11.1px, tagline glyphs 7.4px at a 144px (48dp xxhdpi) tile, versus 9.7px and
  1.3px before. Legacy square icon at 192px: tagline glyphs 21.8px.
- **Honest limit.** At the smallest 48px density the tagline glyphs are 5.4px: the
  words are present and shaped correctly but not readable. Below roughly 96px of
  tile the tagline is decoration, not text. The wordmark stays readable throughout.
- Release notes and the marketplace artwork are unchanged; this is an icon-only
  change plus the shell cache bump to `cineflow-shell-v5`.

---

# CineFlow v0.2.4

## Android launcher icon now carries the complete brand lockup
- The Android launcher icon is generated from the approved full-lockup
  artwork — the film-strip "C" with its play mark, the Cineflow wordmark and the
  **PRIVATE · CINEMA · CONTROL** tagline in one square composition. This
  replaces the symbol-only launcher icon that shipped in 0.2.3.
- The same artwork is now versioned in the app repository at
  `public/brand/cineflow-icon-lockup-512.png`, byte-identical to the asset
  approved and live on the AppMintly marketplace, so the launcher icon and the
  store artwork can never drift apart.
- Adaptive icon (Android 8+): the complete lockup is fitted by its bounding-box
  diagonal inside the 66/108 safe circle, so circular, squircle and
  rounded-square launcher masks keep every element whole — no crop, no zoom.
- Honest limitation, measured rather than assumed: the tagline is a single line
  at 2.1% of the artwork height. Inside a 48dp launcher tile it renders about
  1px tall, so it is present and uncropped but not legible at launcher size.
  The wordmark is legible. The lockup is fully legible in the app's own splash
  and About surfaces, which is where the tagline is meant to be read.
- No functional change: playback, library, playlists, subtitles, MP3
  conversion, device-to-device transfer and local-first storage are untouched.
- Service-worker shell cache bumped to `cineflow-shell-v4` so installed clients
  pick up the new build.

---

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
