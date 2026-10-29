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
