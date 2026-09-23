# Whale Lance: Buffet Brawl

A Streets of Rage-style side-scrolling beat-em-up. The A/C on the *Pride of America* is out, the captain calls **Whale Lance Air Conditioning and Heating**, and Lance has to fight his way through four decks of angry healthy food to fix it — while staying away from the buffet.

Plain HTML5 Canvas + vanilla JavaScript. No build step, no dependencies. Plays on a desktop with keyboard or a gamepad, and on a phone with touch.

The showcase pass tightens the cabinet feel (hit-stop, a directional camera punch, attack buffering, floor tells before dashes and the froyo spoon) and rewrites the mid-fight voice: stage banners, enemy cards, combo ranks, Volcano Fart one-liners, and the ending. The ship temperature stays on the HUD so the cruise reads during the fight.

The canvas now renders at device pixel density on phones and desktops, up to 3840×2160. Auto uses native density; Sharp supersamples low-density screens at 2× or higher. HD modes use smooth edges and no CRT stripes. Pause → Display → Classic retains the 640×360 nearest-neighbor picture and scanlines. The choice is remembered, and changing display quality never changes the input hints or camera lead. The bundled arcade font loads without a Google Fonts connection.

During a stage the control picture stays on screen the whole time, on phones and desktops: touch buttons in the corners, a WASD / arrow diagram (or the pad, if one is connected). It does not hide after the tutorial.

The upgrade pass adds fairer hitboxes and invulnerability frames, readable boss telegraphs, Continue from the current stage and wave, keyboard and gamepad remapping, a timed launcher/juggle, a music-ducking audio mix, pooled particles with a phone budget, a large HUD and colorblind-safe health, smarter enemy AI, and settings that survive a reload.

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
| **Wrench Pop** launcher | Attack, Attack, *wait a beat*, Attack (mashing still gives the sweep) | same | same |
| Duct-tape grab | Walk into an enemy. Attack = knee. Back + Attack or Jump = throw | same | same |
| Jump / flying boot | `Space`, `K` or `X` (+ Attack in the air) | **A** | **JMP** |
| Refrigerant spray (freezes enemies, costs a little HP) | `Q`, `L` or `C` | **Y** | **SPR** |
| Toolbox throw (pick it back up after) | `R`, `I` or `V` | **RB** or **LB** | **BOX** |
| **Volcano Fart** (screen clear, needs a full meter) | `F` or `B` | **B** | **FART** |
| Pause | `Esc`, `P` or `Enter` | **Start** or **Back** | **II** |
| Mute | `M` | pause menu | pause menu |
| Fullscreen | Backslash, or F11 when the browser gives the page that key | pause menu | pause menu |

Pause menu: sound, music, fullscreen, display mode (Auto / Sharp / Classic), **Options** and **Controls**. The title screen has the same panels under **Settings**. Alt-tabbing pauses the fight. A hit rumbles the gamepad when the pad supports it.

Every table row above is a default. **Controls** remaps the primary key for each action (the arcade aliases stay) and each pad action. Binding a key another action uses swaps the two, so nothing is left unbound. Enter, Start, the d-pad, `M` and backslash can't be remapped, so the menus can always be reached. The corner badges, the title/pause legends, the help screen and the tutorial tips all read the live bindings.

**Options:** control overlay strength (25–85%; the plates stay see-through and the picture never hides), HUD size (Normal / Large), health colors (Classic / Colorblind-safe: blue, yellow and vermilion plus an HP number and a striped low-health bar), effects (Auto / Full / Lite) and screen shake (Full / Reduced, which also softens the white hit flashes). Everything, including volume, music level, display mode and remaps, is saved in `localStorage` under `wl-settings`.

### Continue

Clearing a wave saves a small checkpoint (`wl-run`: stage, next wave, score, meter). After a game over, **Continue** resumes the same stage at that wave with half score and three lives; **Restart stage** starts the stage over. The title screen offers **Continue** after a reload. Beating the boss clears the checkpoint.

### Combo depth

Mashing Attack gives the classic screwdriver → wrench → pipe-wrench sweep. Pausing about a tenth of a second after the wrench (a white chevron appears over Lance) turns the third hit into the **Wrench Pop**: the enemy floats and can take up to three follow-ups (jab, wrench or the flying boot) at 80% damage before it drops. It also breaks spinach/kale armor. The HUD shows `WRENCH POP` and `JUGGLE xN`.

### Boss telegraphs

Each boss move draws its own floor shape at the exact size of its hitbox, and plays its own sound when it starts. A countdown ring under the cone fills clockwise. In the last 0.2 s the outline turns solid white and a click plays.

| Move | Shape | Wind-up (phase 1 / 2 / 3) |
| --- | --- | --- |
| Spoon slam | rectangle, filling outward, chevrons | 0.80 / 0.75 / 0.62 s |
| Belly flop | ring + cross at the locked landing spot, dashed outer ring closing in; he lands exactly on it | 0.60 / 0.60 / 0.52 s |
| Topping rain | dashed ring per drop, the true hit ellipse | 0.80 / 0.80 / 0.70 s |
| Backup cups | arrows at the two screen edges | 0.80 s |

The boss bar has notches where phases 2 and 3 begin, and a move legend under the bar lists the moves and their shapes. Moves that unlock later are shown dimmed.

The title screen accepts a click on a menu row. Backslash toggles fullscreen from anywhere.

The same bindings are drawn in the corners for the entire stage, so the diagram is still there after the first wave's tips expire.

### The Volcano Fart

The green meter under Lance's health fills when he eats **beans**, **chili**, **buffet leftovers** and coffee — never salad. When it's full, press Fart: every enemy on screen is launched off the ship with a screen-shaking blast, and the boss takes a huge hit and loses its swirl armor.

Burgers and turkey legs heal. Casino chips are points. Lance hates frozen yogurt: every froyo cup is worth double.

## Fairness tuning

All hit and invulnerability numbers are in `FAIR` in `js/entities.js`. The floor tells draw from the same numbers.

| Setting | Before | Now | Why |
| --- | --- | --- | --- |
| Enemy melee reach | reach + 14 px | reach + 13 px (Lance's half width) | box matches the drawn tell |
| Enemy melee lane tolerance | 26 px | 18 px | enemies only commit inside 16 px, so a side-step during the tell escapes |
| Dash / roll / charge lane tolerance | 22 / 22 / 26 px | 18 / 18 / 20 px | same rule as melee |
| Lance's swing active time | 1 frame | 0.06 s (each enemy hit once) | fewer invisible whiffs when an enemy steps in |
| Lance's swing width | 12 px for every enemy | per-sprite 11–17 px (`hurtW`) | sprouts are small, kale is wide |
| Stun after a light hit | 0.32 s | 0.28 s | |
| Iframes after a light hit | 0.15 s, plus 0.25 s after the stun | 0.56 s from the hit (covers the stun plus ~0.28 s to act) | no re-hit while reeling |
| Light-hit streak | none | third light hit within 1.6 s knocks Lance down | a release with get-up iframes instead of a stun-lock |
| Get-up iframes | 0.9 s | 1.0 s | enemies also hold attacks for the first 0.45 s |
| Enemy light-hit lock | unlimited | fifth un-knocked hit tumbles the enemy | no infinite jab loops |
| Enemy get-up | hittable | 0.35 s invulnerable | no free hits on a rising enemy |
| Boss slam lane | ±40 px | ±34 px, drawn exactly | |
| Topping rain | 26 × 20 px box, smaller ring | 26 × 13 px ellipse, the same ellipse is drawn | |
| Belly-flop landing | chased the target, ring 18–40 px | lands exactly on the locked mark, ring is the true 78 px radius | |

**AI director:** at most two attackers, never from both sides of Lance at once, at least 0.3 s between attack starts, and nobody starts an attack while Lance is reeling or getting up. When everyone is on one side, the farthest goon walks around to flank. It arcs around Lance instead of walking through him. Agile greens (sprout, celery, carrot) sometimes side-step a swing they see coming, but never mid-combo. A whiffed swing lets a nearby enemy start its (fully telegraphed) attack sooner.

In a 12-seed soak with a masher bot (`node tools/soak.cjs . <seed>`), all four stages are still cleared every time. Damage taken per minute fell on every stage (stage 1: 3.0 → 2.9, stage 2: 30.1 → 26.8, stage 3: 21.6 → 16.9, boss stage: 58.6 → 46.2). The worst burst of hits inside 1.5 s never got worse, and on stage 2 it fell from 3 hits to 2.

## Performance

Particles and breakable debris come from a pool that is compacted in place; nothing is allocated per frame for FX. The concurrent cap is 320 on desktop, 180 on coarse pointers and 110 in Lite, and Lite also halves burst sizes. Auto uses Lite on a coarse pointer below 2× DPR, and switches to Lite after three seconds under 48 fps in a fight. Entity shadows use one cached radial sprite instead of a new gradient per body per frame. Sparks and callout text are never dropped.

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
js/settings.js        persistent settings, key/pad remap tables, Continue checkpoint, FX budget
js/assets.js          image loader (every image is optional; drawn fallbacks exist)
js/input.js           keyboard (WASD cluster + arcade keys), gamepad, touch
js/audio.js           WebAudio synthesized SFX and chiptune sequencer (no audio files)
js/voice.js           stage banners, enemy cards, combo ranks, fart lines, barks
js/sprites.js         procedural sprites: Lance (drawn from photo refs), 7 enemy types, boss, items, FX
js/entities.js        Player state machine, enemy AI, boss phases, pickups, projectiles
js/levels.js          stage data, parallax backgrounds, waves, hazards, story text
js/options.js         Options / Controls panels shared by the title and pause menus
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

The deterministic regression harness uses Node.js and `@napi-rs/canvas` (development only). Run `node tools/verify-hd.cjs` with that package available. It exercises phone/retina/4K sizing, display-mode/input independence, keyboard aliases, gamepad mappings, every touch button, all four stage renderers, gameplay updates, background auto-pause, settings persistence across a reload, key/pad remaps and the badges drawn from them, Continue from a wave, iframes and the anti-stun-lock rules, the Wrench Pop juggle, FX pool caps, and boss tell timing/landing. Set `WL_CAPTURE_DIR` to an existing directory to save rendered stage/title images. This is a native Canvas simulation, not a Safari or physical-gamepad test.

## Next improvements

- Detailed character art and animation frames would provide a larger stylistic upgrade than further resolution increases. Preserve the current poses, hitboxes and timing.
- Add a portrait-orientation hint and test sustained high-resolution performance on real iPhones; Classic remains the low-cost fallback.

The public Pages build was behind `main` at the start of this update. Always verify the public `js/main.js` after publishing; a merged graphics commit alone does not prove deployment.
