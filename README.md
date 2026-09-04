# Whale Lance: Buffet Brawl

A Streets of Rage-style side-scrolling beat-em-up. The A/C on the *Pride of America* is out, the captain calls **Whale Lance Air Conditioning and Heating**, and Lance has to fight his way through four decks of angry healthy food to fix it — while staying away from the buffet.

Plain HTML5 Canvas + vanilla JavaScript. No build step, no dependencies. Works on desktop (keyboard) and mobile (touch).

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

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow keys / WASD | Virtual stick (left half of screen) |
| Attack (3-hit tool combo: screwdriver jab → wrench smash → pipe-wrench sweep) | `J` or `Z` | **ATK** |
| Duct-tape grab | Walk into an enemy. Attack = knee. Back + Attack or Jump = throw | same |
| Jump / flying boot | `K`, `X` or `Space` (+ Attack in the air) | **JMP** |
| Refrigerant spray (freezes enemies, costs a little HP) | `L` or `C` | **SPR** |
| Toolbox throw (pick it back up after) | `I` or `V` | **BOX** |
| **Volcano Fart** (screen clear, needs a full meter) | `F` or `B` | **FART** |
| Pause | `P` / `Esc` | **II** |
| Mute | `M` | pause menu |

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
| 1 | Lido Deck buffet / pool deck (tutorial) | broccoli goons, brussels sprouts, celery stalkers |
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
js/input.js           keyboard + multitouch virtual controls
js/audio.js           WebAudio synthesized SFX and chiptune sequencer (no audio files)
js/sprites.js         procedural sprites: Lance (photo head), 7 enemy types, boss, items, FX
js/entities.js        Player state machine, enemy AI, boss phases, pickups, projectiles
js/levels.js          stage data, parallax backgrounds, waves, hazards, story text
js/scenes.js          title, cutscene player, story beats, Play/HUD, pause, game over, ending
js/main.js            bootstrap, scaling, game loop, scene flow
assets/cutscenes/     opening cutscene panels (cutscene-01..04)
assets/lance/         Lance portrait + head crop used by the sprite and HUD
```

### Swapping in art

The loader looks for these exact files; drop replacements in with the same names and nothing else needs to change:

- `assets/cutscenes/cutscene-01-ac-out.png`
- `assets/cutscenes/cutscene-02-captain-calls.png`
- `assets/cutscenes/cutscene-03-lance-arrives.png`
- `assets/cutscenes/cutscene-04-monsters-attack.png`
- `assets/lance/lance-portrait.png` — bust on a transparent background (title/ending)
- `assets/lance/lance-head.png` — head crop, transparent background (in-game sprite)
- `assets/lance/lance-hud.png` — small HUD portrait

### Debug helpers (browser console)

```js
WL.game.debug.play(3)     // jump straight into stage 4 (0-based)
WL.game.debug.boss()      // skip to the boss wave of the current stage
WL.game.debug.fillFart()  // fill the Volcano Fart meter
WL.game.debug.invuln()    // toggle invulnerability on
```

Add `#fps` to the URL to show a frame counter.
