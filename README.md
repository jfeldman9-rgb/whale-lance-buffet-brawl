# Whale Lance: Buffet Brawl

A Streets of Rage-style side-scrolling beat-em-up. The A/C on the *Pride of America* is out, the captain calls **Whale Lance Air Conditioning and Heating**, and Lance has to fight his way through four decks of angry healthy food to fix it — while staying away from the buffet.

Plain HTML5 Canvas + vanilla JavaScript. No build step, no dependencies. Plays on a desktop with keyboard or a gamepad, and on a phone with touch.

The showcase pass tightens the cabinet feel (hit-stop, a directional camera punch, attack buffering, floor tells before dashes and the froyo spoon) and rewrites the mid-fight voice: stage banners, enemy cards, combo ranks, Volcano Fart one-liners, and the ending. The ship temperature stays on the HUD so the cruise reads during the fight.

The canvas now renders at device pixel density on phones and desktops, up to 3840×2160. Auto uses native density; Sharp supersamples low-density screens at 2× or higher. HD modes use smooth edges and no CRT stripes. Pause → Display → Classic retains the 640×360 nearest-neighbor picture and scanlines. The choice is remembered, and changing display quality never changes the input hints or camera lead. The bundled arcade font loads without a Google Fonts connection.

During a stage the control picture stays on screen the whole time, on phones and desktops: touch buttons in the corners, a WASD / arrow diagram (or the pad, if one is connected). It does not hide after the tutorial.

## Play

**Online:** enable GitHub Pages for this repo (Settings → Pages → *Deploy from a branch* → `main`, folder `/ (root)`) and open the published URL.

**Locally:** the game loads its cutscene art with `<img>` so it needs to be served over HTTP (not `file://`):

```bash
# any static server works
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>.

## Controls

Two keyboard layouts work at once: a PC cluster around WASD, and the arcade cluster (right hand on J / K / L).

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | Arrow keys / WASD | Left stick or d-pad | Virtual stick (left half of screen) |
| Attack (screwdriver jab → wrench smash → pipe-wrench sweep) | `E`, `J` or `Z` | **X** | **ATK** |
| Duct-tape grab | Walk into an enemy. Attack = knee. Back + Attack or Jump = throw | same | same |
| Jump / flying boot | `Space`, `K` or `X` (+ Attack in the air) | **A** | **JMP** |
| Refrigerant spray (freezes enemies, costs a little HP) | `Q`, `L` or `C` | **Y** | **SPR** |
| Toolbox throw (pick it back up after) | `R`, `I` or `V` | **RB** or **LB** | **BOX** |
| **Volcano Fart** (screen clear, needs a full meter) | `F` or `B` | **B** | **FART** |
| Pause | `Esc`, `P` or `Enter` | **Start** or **Back** | **II** |
| Mute | `M` | pause menu | pause menu |
| Fullscreen | Backslash, or F11 when the browser gives the page that key | pause menu | pause menu |

Pause menu on desktop: sound volume (left/right), fullscreen, and display mode (Auto / Sharp / Classic). Alt-tabbing pauses the fight. A hit rumbles the gamepad when the pad supports it.

The title screen accepts a click on a menu row. Backslash toggles fullscreen from anywhere.

The same bindings are drawn in the corners for the entire stage, so the diagram is still there after the first wave's tips expire.

### The Volcano Fart

The green meter under Lance's health fills when he eats **beans**, **chili**, **buffet leftovers** and coffee — never salad. When it's full, press Fart: every enemy on screen is launched off the ship with a screen-shaking blast, and the boss takes a huge hit and loses its swirl armor.

Burgers and turkey legs heal. Casino chips are points. Lance hates frozen yogurt: every froyo cup is worth double.

## Story

1. **The A/C is out** — the Pride of America bakes off Hawaii.
2. **The captain calls for help** — "Get me Whale Lance Air Conditioning!"
3. **Lance arrives** — the captain tells him to stay away from the buffet.
4. **Healthy food attack!** — while fixing the ducts, the salad bar strikes back.

Then four stages aboard the ship, each ending with an A/C repair log and the ship's temperature dropping:

| Stage | Ship space | Enemies |
| --- | --- | --- |
| 1 | Lido Deck buffet / pool deck (tutorial) — "the salad bar clocked in" | broccoli goons, brussels sprouts, celery stalkers |
| 2 | A/C plant / pipe corridors (steam vents) | carrot ninjas, spinach thugs |
| 3 | Spa & juice bar (elite greens) | kale bruisers, frozen yogurt cups |
| 4 | Freezer / dessert station | **Giant Frozen Yogurt Cone** boss: swirl armor → sprinkle rain → meltdown puddles |

Ending: the A/C hums at 72°F and Lance, after four decks of cardio and one very committed fart, is *svelte*.

## Project layout

```
index.html            entry point (GitHub Pages ready, served from repo root)
css/style.css
js/util.js            helpers, text and drawing primitives
js/assets.js          image loader (every image is optional; drawn fallbacks exist)
js/input.js           keyboard (WASD cluster + arcade keys), gamepad, touch
js/audio.js           WebAudio synthesized SFX and chiptune sequencer (no audio files)
js/voice.js           stage banners, enemy cards, combo ranks, fart lines, barks
js/sprites.js         procedural sprites: Lance (drawn from photo refs), 7 enemy types, boss, items, FX
js/entities.js        Player state machine, enemy AI, boss phases, pickups, projectiles
js/levels.js          stage data, parallax backgrounds, waves, hazards, story text
js/scenes.js          title, cutscene player, story beats, Play/HUD, pause, game over, ending
js/main.js            bootstrap, scaling, game loop, scene flow
assets/cutscenes/     opening cutscene panels (cutscene-01..04)
tools/                make_lance_portraits.py: turns a real photo into the optional likeness PNGs
```

### Swapping in art

The loader looks for these exact files; drop replacements in with the same names and nothing else needs to change:

- `assets/cutscenes/cutscene-01-ac-out.png`
- `assets/cutscenes/cutscene-02-captain-calls.png`
- `assets/cutscenes/cutscene-03-lance-arrives.png`
- `assets/cutscenes/cutscene-04-monsters-attack.png`
- `assets/lance/lance-portrait.png` — bust on a transparent background (title/ending)
- `assets/lance/lance-head.png` — face crop (in-game sprite head; masked to an oval at draw time)
- `assets/lance/lance-hud.png` — small HUD portrait

### Lance's likeness

Lance is drawn entirely in code (`drawLance`, `lanceHead`, `drawLanceBust` in `js/sprites.js`) to match the
reference photos: thinning white hair combed back, prominent white mustache, tan/ruddy complexion, red polo with a
purple-and-white lei, gray cargo shorts, black sneakers, and a mechanic's tool belt worn over the polo. No AI-generated
composites are used; the three `assets/lance/*.png` files are **optional** and the repo ships without them.

To use crops of the real photos instead of the drawn head, run:

```bash
pip install pillow
python3 tools/make_lance_portraits.py path/to/lance-face-toast.png --face X,Y,W,H [--bust X,Y,W,H]
```

`--face` is the pixel box around the head (hairline to chin); the script writes the three PNGs above with an oval
alpha mask and the game picks them up automatically on the next load.

### Debug helpers (browser console)

```js
WL.game.debug.play(3)     // jump straight into stage 4 (0-based)
WL.game.debug.boss()      // skip to the boss wave of the current stage
WL.game.debug.fillFart()  // fill the Volcano Fart meter
WL.game.debug.invuln()    // toggle invulnerability on
```

Add `#fps` to the URL to show a frame counter.

## HD rendering verification

The deterministic regression harness uses Node.js and `@napi-rs/canvas` (development only). Run `node tools/verify-hd.cjs` with that package available. It exercises phone/retina/4K sizing, display-mode/input independence, keyboard aliases, gamepad mappings, every touch button, all four stage renderers, gameplay updates, and background auto-pause. Set `WL_CAPTURE_DIR` to an existing directory to save rendered stage/title images. This is a native Canvas simulation, not a Safari or physical-gamepad test.

## Next improvements

- Detailed character art and animation frames would provide a larger stylistic upgrade than further resolution increases. Preserve the current poses, hitboxes and timing.
- The persistent control panels cover part of the fighting area. A future optional opacity setting could improve visibility without moving the touch targets.
- Save progress between decks; currently reloading loses the run.
- Add a portrait-orientation hint and test sustained high-resolution performance on real iPhones; Classic remains the low-cost fallback.

The public Pages build was behind `main` at the start of this update. Always verify the public `js/main.js` after publishing; a merged graphics commit alone does not prove deployment.
