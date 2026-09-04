#!/usr/bin/env python3
"""Turn a real photo of Lance into the optional likeness PNGs the game loads.

    python3 tools/make_lance_portraits.py photo.png --face X,Y,W,H [--bust X,Y,W,H]

--face  pixel box around the head (hairline to chin, ear to ear). Used for
        assets/lance/lance-head.png (sprite head) and lance-hud.png (HUD).
--bust  optional pixel box for head + shoulders, used for lance-portrait.png
        (title / ending). Defaults to a box grown downward from --face.

Each output is masked to an oval with a soft edge so the photo sits cleanly on
the drawn body. Delete the PNGs to go back to the fully drawn Lance.
"""
import argparse
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required: pip install pillow")

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "lance")


def parse_box(s):
    x, y, w, h = (int(v) for v in s.split(","))
    return x, y, w, h


def oval_crop(img, box, size, feather=2):
    x, y, w, h = box
    crop = img.crop((x, y, x + w, y + h)).convert("RGBA").resize(size, Image.LANCZOS)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size[0] - 1, size[1] - 1), fill=255)
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    crop.putalpha(mask)
    return crop


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo")
    ap.add_argument("--face", required=True, type=parse_box, help="X,Y,W,H box around the head")
    ap.add_argument("--bust", type=parse_box, help="X,Y,W,H box around head and shoulders")
    ap.add_argument("--out", default=OUT_DIR)
    args = ap.parse_args()

    img = Image.open(args.photo)
    os.makedirs(args.out, exist_ok=True)

    fx, fy, fw, fh = args.face
    head = oval_crop(img, (fx, fy, fw, fh), (96, int(96 * fh / fw)), feather=1)
    head.save(os.path.join(args.out, "lance-head.png"))

    hud = oval_crop(img, (fx, fy, fw, fh), (52, 60), feather=1)
    hud.save(os.path.join(args.out, "lance-hud.png"))

    if args.bust:
        bx, by, bw, bh = args.bust
    else:
        bw, bh = int(fw * 2.2), int(fh * 2.4)
        bx, by = fx + fw // 2 - bw // 2, fy - fh // 6
    bx, by = max(0, bx), max(0, by)
    bw, bh = min(bw, img.width - bx), min(bh, img.height - by)
    bust = oval_crop(img, (bx, by, bw, bh), (int(300 * bw / bh), 300), feather=4)
    bust.save(os.path.join(args.out, "lance-portrait.png"))

    print("wrote lance-head.png, lance-hud.png, lance-portrait.png to", args.out)


if __name__ == "__main__":
    main()
