#!/usr/bin/env python3
"""Compose the Android launcher icon from the approved CineFlow lockup.

Source of truth: public/brand/cineflow-icon-lockup-512.png (the production-approved
artwork). No shape, glyph or colour is redrawn: the symbol, the wordmark and the
tagline words are cropped out of that file as rasters and re-laid out.

Why re-lay out at all: the lockup is a 37:1 single-line tagline under a 5.4:1
wordmark under the symbol. Squeezed into one square by Android's 66/108 adaptive
safe circle, the tagline lands at ~1% of the tile and reads as the symbol alone.
Here the tagline is stacked one word per line using the original word rasters, so
each line keeps a ~7:1 aspect and the text survives at launcher size.

Output: public/brand/cineflow-launcher-1024.png (1024x1024, white plate, opaque).
"""
from PIL import Image
import numpy as np, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public/brand/cineflow-icon-lockup-512.png')
OUT = os.path.join(ROOT, 'public/brand/cineflow-launcher-1024.png')

# Element bands and column groups measured from the approved asset (see
# tests/launcher-icon.test.ts, which re-derives them and fails on drift).
SYMBOL_Y, WORDMARK_Y, TAGLINE_Y = (36, 367), (370, 450), (465, 475)
WORDS_X = {'PRIVATE': (106, 182), 'CINEMA': (212, 284), 'CONTROL': (314, 403)}

CANVAS, PLATE = 1024, (255, 255, 255)
SYMBOL_H, WORDMARK_W, LINE_H, LINE_GAP = 220, 940, 116, 26

def crop_box(img, xs, ybox):
    return img.crop((xs[0], ybox[0], xs[1], ybox[1] + 1))

def ink_bbox(img):
    a = np.asarray(img.convert('RGB')).astype(int)
    bg = a[0, 0]
    m = np.abs(a - bg).max(axis=2) > 40
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def main():
    src = Image.open(SRC).convert('RGB')
    sym = src.crop((102, SYMBOL_Y[0], 411, SYMBOL_Y[1] + 1))
    wm = src.crop((37, WORDMARK_Y[0], 476, WORDMARK_Y[1] + 1))
    words = {w: crop_box(src, x, TAGLINE_Y) for w, x in WORDS_X.items()}

    def scale_to_h(im, h):
        return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)

    def scale_to_w(im, w):
        return im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)

    sym, wm = scale_to_h(sym, SYMBOL_H), scale_to_w(wm, WORDMARK_W)
    lines = [scale_to_h(words[w], LINE_H) for w in ('PRIVATE', 'CINEMA', 'CONTROL')]

    seq = [sym, wm, *lines]
    block_h = sum(im.height for im in seq) + LINE_GAP * (len(seq) - 1)
    canvas = Image.new('RGB', (CANVAS, CANVAS), PLATE)
    y = (CANVAS - block_h) // 2
    for im in seq:
        canvas.paste(im, ((CANVAS - im.width) // 2, y))
        y += im.height + LINE_GAP
    # tight re-centre on the real ink so the composition is symmetric
    bbox = ink_bbox(canvas)
    art = canvas.crop(bbox)
    plate = Image.new('RGB', (CANVAS, CANVAS), PLATE)
    plate.paste(art, ((CANVAS - art.width) // 2, (CANVAS - art.height) // 2))
    plate.save(OUT, optimize=True)
    print(f'  composed {OUT}: art {art.width}x{art.height} in {CANVAS} '
          f'({art.width/CANVAS:.0%} wide, {art.height/CANVAS:.0%} tall)')

if __name__ == '__main__':
    main()
