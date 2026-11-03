#!/usr/bin/env python3
"""Build the Android launcher icon from the SUPPLIED CineFlow logo, unmodified.

Owner rule (2026-11-03, final): the supplied logo is the single source of truth.
The launcher icon must carry the complete original composition — film-strip C
symbol, "Cineflow" wordmark with its gradients, and the PRIVATE · CINEMA · CONTROL
tagline — with its original spacing, alignment and proportions. Nothing is
redrawn, simplified, re-coloured, cropped, stretched, rearranged or removed.

So this script does exactly two things to the original raster:
  1. finds the artwork's ink bounding box (the file has whitespace around it),
  2. uniformly scales that box to fit the icon canvas with even padding, and
     centres it on a plate sampled from the original's own background colour.

Aspect ratio is preserved exactly: one scale factor for both axes. The internal
layout of the artwork is never touched, so the tagline stays on the single line it
was drawn on.

Output: public/brand/cineflow-launcher-1024.png
"""
from PIL import Image
import numpy as np, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'brand-source/cineflow-logo-original.png')
OUT = os.path.join(ROOT, 'public/brand/cineflow-launcher-1024.png')

CANVAS = 1024
ART_FRACTION = 0.90   # artwork width as a fraction of the canvas, even padding both sides


def art_bbox(img):
    a = np.asarray(img.convert('RGB')).astype(int)
    bg = a[2, 2]
    m = np.abs(a - bg).max(axis=2) > 40
    ys, xs = np.where(m)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1), tuple(int(v) for v in bg)


def main():
    src = Image.open(SRC).convert('RGB')
    (x0, y0, x1, y1), bg = art_bbox(src)
    art = src.crop((x0, y0, x1, y1))
    w, h = art.size
    # uniform scale: identical factor on both axes, so nothing is stretched
    s = (CANVAS * ART_FRACTION) / max(w, h)
    scaled = art.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    plate = Image.new('RGB', (CANVAS, CANVAS), bg)
    plate.paste(scaled, ((CANVAS - scaled.width) // 2, (CANVAS - scaled.height) // 2))
    plate.save(OUT, optimize=True)
    print(f'  source {src.size}, art bbox {x1-x0}x{y1-y0} at ({x0},{y0}), plate {bg}')
    print(f'  -> {OUT}: art {scaled.width}x{scaled.height} ({scaled.width/CANVAS:.1%} wide), '
          f'aspect {scaled.width/scaled.height:.3f} vs source {w/h:.3f}')


if __name__ == '__main__':
    main()
