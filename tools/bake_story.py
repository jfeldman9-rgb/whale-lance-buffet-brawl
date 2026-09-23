#!/usr/bin/env python3
"""Bake the painted story plates: generated 16:9 PNGs -> assets/cutscenes/*.webp.

Usage: python3 tools/bake_story.py SRC_DIR   (needs Pillow)

SRC_DIR holds <name>.png for every entry in PLATES (1280x720 or larger, 16:9) and
captain-portrait.png (square). Plates were generated with an image model using
tools/art-src/title-art.webp (style, Lance, the greens), tools/art-src/lance-portrait.webp
(Lance's face) and captain-portrait.png (the Captain) as references; the scene
brief for each plate is kept below so a plate can be regenerated on-model.
"""
import os
import sys

from PIL import Image

STYLE = ("Painted 3D-feel cinematic frame in the style of the title key art: warm Hawaiian light, "
         "crisp rim light, saturated colors, depth of field; calm lower fifth for captions; no text or UI.")
LANCE = ("Whale Lance: heavyset older man, thick swept-back white hair, big white walrus mustache, red hibiscus "
         "Hawaiian shirt, purple-and-white plumeria lei, leather tool belt, gray cargo shorts, black sneakers.")
PLATES = {
    'op1-ac-out': 'Noon heat on the Lido deck: melting swan ice sculpture, dead A/C unit with a red light and smoke, wilting tourists, Diamond Head.',
    'op2-captain-calls': 'Captain Andersen sweating on the bridge, shouting into a red phone, red alarm light, temperature gauge in the red.',
    'op3-lance-arrives': 'Lance strides onto the Lido deck with toolbox and pipe wrench; the Captain points him away from the glowing buffet.',
    'op4-salad-strikes': 'The salad bar explodes: broccoli goon through the sneeze guard, CRUNCH CREW carrot, sprouts; Lance raises the pipe wrench.',
    'st1-lido-intro': 'Vegetable picket line (broccoli goons, carrot with bullhorn, sprouts) blocks the compressor; Lance with toolbox, unimpressed.',
    'st1-lido-outro': 'Lance yanks a huge wad of kale out of the air-handler intake; dazed greens on the deck, duct tape, open toolbox.',
    'st2-plant-intro': 'The A/C plant: pipes, steam, gauges in the red; three carrot ninjas with shuriken; Lance grips the pipe wrench.',
    'st2-plant-outro': 'Lance duct-tapes the compressor, gauges swing to blue, carrot ninjas duct-taped to a pipe behind him.',
    'st3-spa-intro': 'Spa and juice bar: flexing kale bruiser and two angry froyo cups face Lance holding a refrigerant can.',
    'st3-spa-outro': 'Frosted freezer door leaking pink glow and a strawberry drip; Lance with flashlight; wrecked juice bar, dazed kale.',
    'st4-freezer-intro': 'Icy freezer: giant strawberry froyo cone boss with sprinkle armor and a giant spoon; Lance small in the foreground.',
    'end1-last-valve': 'Lance turns the red valve wheel, cool air blasts, the cone boss is a pink puddle with a dizzy waffle cone.',
    'end2-svelte': 'Golden hour on the Lido: the Captain shakes hands with a slimmer Lance, cheering passengers, restored ice swan.',
    'end3-carving-station': 'Sunset carving station: Lance raises a turkey leg with a plate of prime rib, the Captain toasts, chef carves.',
}
PLATE_W, PLATE_H, PLATE_Q = 1280, 720, 86
PORTRAIT, PORTRAIT_Q = 384, 88


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    src = sys.argv[1]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'assets', 'cutscenes')
    os.makedirs(out, exist_ok=True)
    for name in PLATES:
        im = Image.open(os.path.join(src, name + '.png')).convert('RGB')
        w, h = im.size
        # Center-crop to exactly 16:9 before resizing.
        tw = min(w, round(h * 16 / 9))
        th = round(tw * 9 / 16)
        im = im.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th))
        if im.size != (PLATE_W, PLATE_H):
            im = im.resize((PLATE_W, PLATE_H), Image.LANCZOS)
        path = os.path.join(out, name + '.webp')
        im.save(path, 'WEBP', quality=PLATE_Q, method=6)
        print(f'{path}: {os.path.getsize(path) // 1024} KB')
    cap = Image.open(os.path.join(src, 'captain-portrait.png')).convert('RGB')
    w, h = cap.size
    s = min(w, h)
    cap = cap.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((PORTRAIT, PORTRAIT), Image.LANCZOS)
    path = os.path.join(out, 'captain-portrait.webp')
    cap.save(path, 'WEBP', quality=PORTRAIT_Q, method=6)
    print(f'{path}: {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    main()
