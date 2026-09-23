#!/usr/bin/env python3
"""Bake painted sprite sheets into game atlases.

    pip install pillow numpy scipy
    python3 tools/bake_art.py            # reads tools/art-src/*, writes assets/art/* and js/artdata.js

Each source sheet is a painted pose sheet on a flat chroma background (green for
Lance, magenta for the greens, see SHEETS). The script keys the background out,
removes colour spill from the edges, splits the sheet into figures by connected
components (left to right), finds each figure's foot anchor, scales it to the
world size the game expects, and packs every character into one WebP atlas.
js/artdata.js gets the frame table: atlas rect, anchor and world scale.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'art-src')
OUT = os.path.join(ROOT, 'assets', 'art')

# World height (640x360 px) of the reference standing frame of each character,
# and how many atlas pixels to keep per world pixel (4 = crisp at 1440p).
CHARS = {
    'lance':    {'ref': 'idle', 'h': 104, 'ppw': 4.0},
    'broccoli': {'ref': 'idle', 'h': 80,  'ppw': 4.0},
    'carrot':   {'ref': 'idle', 'h': 74,  'ppw': 4.0},
    'sprout':   {'ref': 'idle', 'h': 44,  'ppw': 4.0},
    'celery':   {'ref': 'idle', 'h': 92,  'ppw': 4.0},
}

# sheet file -> (character, frame names left to right, facing of the painted figures)
SHEETS = [
    ('lance-sheet-a', 'lance', ['idle0', 'walk0', 'smashWind', 'sweepWind'], 1),
    ('lance-sheet-b', 'lance', ['jab', 'sweep', 'uppercut', 'walk1'], 1),
    ('lance-sheet-c', 'lance', ['throw', 'carry', 'spray', 'grab'], 1),
    ('lance-sheet-d', 'lance', ['hurt', 'down', 'jump', 'jumpkick'], 1),
    ('lance-sheet-e', 'lance', ['fartCharge', None, 'victory', 'grabHit'], 1),
    ('lance-sheet-f', 'lance', ['smash', 'fart', 'popWind', 'idle'], 1),
    ('broccoli-sheet-a', 'broccoli', ['idle', 'walk0', 'windup', 'attack'], -1),
    ('broccoli-sheet-b', 'broccoli', ['walk1', 'hurt', 'down'], -1),
    ('carrot-sheet-a', 'carrot', ['idle', 'walk0', 'windup', 'kick'], -1),
    ('carrot-sheet-b', 'carrot', ['walk1', 'hurt', 'down'], -1),
    ('sprout-sheet-a', 'sprout', ['idle', 'walk0', 'walk1', None, 'attack', 'hurt'], -1),
    ('sprout-sheet-b', 'sprout', ['windup', 'dash', 'down'], -1),
    ('celery-sheet-a', 'celery', ['idle', 'walk0', 'windup', 'attack'], -1),
    ('celery-sheet-b', 'celery', ['walk1', 'hurt', 'down'], -1),
]
LYING = {'down'}


def load_src(name):
    for ext in ('.png', '.webp'):  # .png wins so fresh exports can be dropped in
        p = os.path.join(SRC, name + ext)
        if os.path.exists(p):
            return Image.open(p).convert('RGB')
    raise FileNotFoundError(name)


def key_out(img):
    """Chroma key in CbCr with edge unmixing; returns an RGBA float array."""
    rgb = np.asarray(img).astype(np.float32)
    ycc = np.asarray(img.convert('YCbCr')).astype(np.float32)
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # Plates have walls and floors on their borders, so classify the key by hue
    # (whichever chroma colour dominates the border) and sample it everywhere.
    hints = [(R > 150) & (G < 70) & (B > 50) & (R > B), (G > 150) & (R < 110) & (B < 110), (B > 150) & (R < 90) & (G < 140)]
    edge = np.zeros(R.shape, bool); edge[:8] = edge[-8:] = True; edge[:, :8] = edge[:, -8:] = True
    hint = max(hints, key=lambda h: (h & edge).sum())
    key = np.median(rgb[hint], 0)
    kcc = np.median(ycc[hint], 0)
    d = np.hypot(ycc[..., 1] - kcc[1], ycc[..., 2] - kcc[2])
    a = np.clip((d - 22.0) / 40.0, 0, 1)
    # Enclosed pockets that are only key-ish (pink hibiscus on a sign) stay opaque;
    # true background showing through gaps (rail bars) matches the key almost exactly.
    lab, n = ndimage.label(a < 0.5)
    if n > 1:
        idx = np.arange(1, n + 1)
        area = ndimage.sum(np.ones_like(d), lab, idx)
        med = ndimage.median(d, lab, idx)
        restore = np.zeros(n + 1, bool)
        restore[1:] = (area < 4000) & (med > 9)
        a = np.where(restore[lab], 1.0, a)
    # unmix the key colour out of partially covered edge pixels
    am = np.maximum(a, 1e-3)[..., None]
    fg = (rgb - (1 - a[..., None]) * key) / am
    fg = np.where(a[..., None] > 0.02, np.clip(fg, 0, 255), 0)
    green_key = key[1] > max(key[0], key[2])
    r, g, b = fg[..., 0], fg[..., 1], fg[..., 2]
    if green_key:
        g = np.minimum(g, np.maximum(r, b) * 1.02 + 4)
    else:
        edge = ndimage.binary_dilation(a < 0.98, iterations=3)
        s = np.clip(np.minimum(r, b) - g, 0, None) * edge * 0.8
        r = r - s; b = b - s
    fg = np.stack([r, g, b], -1)
    # choke the matte by a fraction of a pixel to kill the last fringe
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255 * 0.35 + a * 0.65
    return np.concatenate([fg, a[..., None]], -1)


def figures(rgba, n):
    """Split a sheet into its n biggest figures, left to right; stray bits join the nearest."""
    solid = rgba[..., 3] > 0.35
    lab, cnt = ndimage.label(ndimage.binary_dilation(solid, iterations=2))
    sizes = ndimage.sum(solid, lab, range(1, cnt + 1))
    order = np.argsort(sizes)[::-1]
    big = [i + 1 for i in order[:n]]
    boxes = ndimage.find_objects(lab)
    cents = {i: ((boxes[i - 1][1].start + boxes[i - 1][1].stop) / 2) for i in big}
    owner = np.zeros(cnt + 1, int)
    for i in big:
        owner[i] = i
    for i in range(1, cnt + 1):
        if owner[i] or sizes[i - 1] < 60:
            continue
        cx = (boxes[i - 1][1].start + boxes[i - 1][1].stop) / 2
        j = min(big, key=lambda k: abs(cents[k] - cx))
        if abs(cents[j] - cx) < 220:
            owner[i] = j
    out = []
    for i in sorted(big, key=lambda k: cents[k]):
        m = (owner[lab] == i) & (rgba[..., 3] > 0.004)
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = rgba[y0:y1, x0:x1].copy()
        crop[..., 3] *= m[y0:y1, x0:x1]
        out.append(crop)
    return out


def anchor(crop, name):
    a = crop[..., 3] > 0.5
    h, w = a.shape
    if name in LYING:
        xs = np.nonzero(a.any(0))[0]
        return (xs.min() + xs.max()) / 2, h
    rows = np.nonzero(a.any(1))[0]
    top, bot = rows.min(), rows.max()
    # hips: the shorts band sits ~62-74% down a standing figure
    band = a[int(top + (bot - top) * 0.60): int(top + (bot - top) * 0.74)]
    xs = np.nonzero(band)[1]
    ax = float(np.median(xs)) if len(xs) else w / 2
    return ax, float(bot + 1)


def text_patch(crop, mode):
    """Rect around printed shirt lettering, so the game can un-mirror it when the figure is flipped."""
    rgb, a = crop[..., :3], crop[..., 3] > 0.5
    mx, mn = rgb.max(-1), rgb.min(-1)
    if mode == 'dark-on-light':
        cloth = a & (mn > 150) & (mx - mn < 45)
        ink = a & (mx < 110)
    else:
        cloth = a & (mx < 70)
        ink = a & (mn > 140)
    held = ndimage.binary_fill_holes(ndimage.binary_closing(cloth, iterations=2)) & ink & ~cloth
    if held.sum() < 30:
        return None
    lab, n = ndimage.label(ndimage.binary_dilation(held, iterations=5))
    sizes = ndimage.sum(held, lab, range(1, n + 1))
    sl = ndimage.find_objects(lab)[int(np.argmax(sizes))]
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
    return max(0, x0 - 3), max(0, y0 - 3), min(crop.shape[1], x1 + 3), min(crop.shape[0], y1 + 3)


TEXT = {'broccoli': 'dark-on-light', 'carrot': 'light-on-dark'}


# Prop sheets: (sheet, frame names in reading order, world height of each frame)
PROP_SHEETS = [
    ('lido-props', [('caution', 44), ('bush', 60), ('platesStack', 30), ('cart', 44), ('lounger', 30)]),
    ('lido-items', [('beans', 20), ('chili', 14), ('leftovers', 14), ('burger', 16), ('turkey', 15), ('chip', 13),
                    ('toolbox', 16), ('coffee', 17), ('tray', 34), ('cooler', 28), ('crate', 34), ('chair', 42)]),
    ('lido-debris', [(n, 12) for n in ['floret', 'floret2', 'lettuce', 'kale', 'tomato', 'cherry', 'coin', 'stick', 'cucumber',
                                         'sproutHalf', 'shard', 'shard2', 'fork', 'spoon', 'radish', 'pepper', 'splash', 'crouton']]),
]
DEBRIS = {n for n, _ in PROP_SHEETS[2][1]}
# Painted plates: name -> (keyed?, max output width, feathered side edges in px)
PLATES = {
    'lido-far': (False, 1600, 0),
    'lido-mid-ship': (True, 1280, 18),
    'lido-mid-pool': (True, 1280, 18),
    'lido-mid-deck': (True, 1280, 18),
    'lido-buffet': (True, 1280, 0),
    'logo': (True, 1100, 0),
    'title-art': (False, 1600, 0),
    'lance-portrait': (False, 384, 0),
}


def reading_order(figs_with_pos):
    """Sort (cy, cx, item) into rows, then left to right."""
    items = sorted(figs_with_pos, key=lambda t: t[0])
    rows, cur = [], [items[0]]
    for it in items[1:]:
        if it[0] - cur[-1][0] > 60:
            rows.append(cur); cur = [it]
        else:
            cur.append(it)
    rows.append(cur)
    return [it[2] for row in rows for it in sorted(row, key=lambda t: t[1])]


def grid_figures(rgba, n):
    solid = rgba[..., 3] > 0.35
    lab, cnt = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
    sizes = ndimage.sum(solid, lab, range(1, cnt + 1))
    big = [int(i) + 1 for i in np.argsort(sizes)[::-1][:n]]
    boxes = ndimage.find_objects(lab)
    out = []
    for i in big:
        sl = boxes[i - 1]
        crop = rgba[sl].copy()
        crop[..., 3] *= (lab[sl] == i)
        out.append(((sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2, crop))
    return reading_order(out)


def to_image(rgba):
    return Image.fromarray(np.dstack([rgba[..., :3], rgba[..., 3:] * 255]).clip(0, 255).astype(np.uint8), 'RGBA')


def bake_props(table):
    packed = []
    for sheet, names in PROP_SHEETS:
        figs = grid_figures(key_out(load_src(sheet)), len(names))
        for (name, wh), crop in zip(names, figs):
            im = to_image(crop)
            k = wh * 4.0 / (im.height if name not in DEBRIS else max(im.width, im.height))
            im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
            ax, ay = im.width / 2, (im.height / 2 if name in DEBRIS else im.height)
            packed.append((name, im, [round(ax, 1), round(ay, 1), 0, 1]))
    W = 2048
    x = y = rowh = 0
    meta, place = {}, []
    for name, im, extra in sorted(packed, key=lambda p: -p[1].height):
        if x + im.width + 2 > W:
            x, y, rowh = 0, y + rowh + 2, 0
        place.append((name, im, x, y, extra)); x += im.width + 2; rowh = max(rowh, im.height)
    atlas = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
    for name, im, px, py, extra in place:
        atlas.paste(im, (px, py)); meta[name] = [px, py, im.width, im.height] + extra
    path = os.path.join(OUT, 'props.webp')
    atlas.save(path, 'WEBP', quality=86, method=4)
    table['props'] = {'src': 'assets/art/props.webp', 'k': 0.25, 'f': meta}
    print(f'props: {len(meta)} frames, atlas {atlas.size}, {os.path.getsize(path) // 1024} KB')


def seamless_x(img, overlap):
    a = np.asarray(img).astype(np.float32)
    w = a.shape[1]
    out = a[:, :w - overlap].copy()
    t = np.linspace(0, 1, overlap)[None, :, None]
    out[:, :overlap] = a[:, w - overlap:] * (1 - t) + a[:, :overlap] * t
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def bake_plates(table):
    plates = {}
    for name, (keyed, maxw, feather) in PLATES.items():
        src = load_src(name)
        if keyed:
            rgba = key_out(src)
            a = rgba[..., 3]
            ys, xs = np.nonzero(a > 0.02)
            rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1] if name in ('logo', 'lido-buffet') else rgba[ys.min():]
            if feather:
                w = rgba.shape[1]
                ramp = np.clip(np.minimum(np.arange(w), np.arange(w)[::-1]) / feather, 0, 1)
                rgba[..., 3] *= ramp[None, :]
            im = to_image(rgba)
        else:
            im = src
        if im.width > maxw:
            im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
        path = os.path.join(OUT, name + '.webp')
        im.save(path, 'WEBP', quality=84 if keyed else 80, method=4)
        plates[name] = {'src': 'assets/art/' + name + '.webp', 'w': im.width, 'h': im.height}
        print(f'{name}: {im.size}, {os.path.getsize(path) // 1024} KB')
    floor = seamless_x(load_src('lido-floor'), 160)
    floor = floor.resize((1120, 720), Image.LANCZOS)
    floor.save(os.path.join(OUT, 'lido-floor.webp'), 'WEBP', quality=82, method=4)
    plates['lido-floor'] = {'src': 'assets/art/lido-floor.webp', 'w': floor.width, 'h': floor.height}
    table['plates'] = plates


def main():
    os.makedirs(OUT, exist_ok=True)
    frames = {c: {} for c in CHARS}
    for sheet, ch, names, facing in SHEETS:
        rgba = key_out(load_src(sheet))
        figs = figures(rgba, len(names))
        for name, crop in zip(names, figs):
            if name:
                frames[ch][name] = (crop, facing)
    table = {}
    for ch, spec in CHARS.items():
        fr = frames[ch]
        ref = fr[spec['ref']][0]
        ref_h = (ref[..., 3] > 0.5).any(1).sum()
        wpp = spec['h'] / ref_h            # world px per source px
        k = min(1.0, wpp * spec['ppw'])    # atlas px per source px
        packed, meta = [], {}
        for name, (crop, facing) in fr.items():
            ax, ay = anchor(crop, name)
            full = np.dstack([crop[..., :3], crop[..., 3:] * 255]).clip(0, 255).astype(np.uint8)
            im = Image.fromarray(full, 'RGBA')
            size = lambda w, h: (max(1, round(w * k)), max(1, round(h * k)))
            if k < 1:
                im = im.resize(size(im.width, im.height), Image.LANCZOS)
            packed.append((name, im, [round(ax * k, 1), round(ay * k, 1), 0, facing]))
            box = text_patch(crop, TEXT[ch]) if ch in TEXT and name not in LYING else None
            if box:
                x0, y0, x1, y1 = box
                p = full[y0:y1, x0:x1].astype(np.float32)
                h, w = p.shape[:2]
                fy = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
                fx = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
                p[..., 3] *= np.clip(np.minimum(fx, fy) / 3.0, 0, 1)
                pim = Image.fromarray(p.clip(0, 255).astype(np.uint8), 'RGBA')
                if k < 1:
                    pim = pim.resize(size(w, h), Image.LANCZOS)
                packed.append((name + '~t', pim, [round(x0 * k, 1), round(y0 * k, 1)]))
        # shelf pack, 2px gutters
        W = 2048
        x = y = rowh = 0
        place = []
        for name, im, extra in sorted(packed, key=lambda p: -p[1].height):
            if x + im.width + 2 > W:
                x, y, rowh = 0, y + rowh + 2, 0
            place.append((name, im, x, y, extra))
            x += im.width + 2
            rowh = max(rowh, im.height)
        atlas = Image.new('RGBA', (W, y + rowh), (0, 0, 0, 0))
        for name, im, px, py, extra in place:
            atlas.paste(im, (px, py))
            meta[name] = [px, py, im.width, im.height] + extra
        path = os.path.join(OUT, ch + '.webp')
        atlas.save(path, 'WEBP', quality=86, method=4, exact=False)
        table[ch] = {'src': 'assets/art/' + ch + '.webp', 'k': round(wpp / k, 5), 'f': meta}
        print(f'{ch}: {len(meta)} frames, atlas {atlas.size}, {os.path.getsize(path) // 1024} KB, {1 / (wpp / k):.2f} px/world')
    bake_props(table)
    bake_plates(table)
    js = '/* Generated by tools/bake_art.py: painted sprite atlases.\n   f[name] = [x, y, w, h, anchorX, anchorY, reserved, paintedFacing] in atlas px; k = world px per atlas px.\n   f[name + "~t"] = [x, y, w, h, offsetX, offsetY]: shirt lettering to redraw un-mirrored on a flipped frame. */\n'
    js += "'use strict';\nWL.ARTDATA = " + json.dumps(table, separators=(',', ':')) + ';\n'
    with open(os.path.join(ROOT, 'js', 'artdata.js'), 'w') as f:
        f.write(js)


if __name__ == '__main__':
    main()
