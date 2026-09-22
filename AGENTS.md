# AGENTS.md — Whale Lance: Buffet Brawl (for Cursor / future cloud agents)

## 1. Branch from latest `main` + cache-bust rule

- Always branch from latest `main` before starting work. Current tip at time of writing: `1094027` ("Fix clickable BOX controls and make combat overlays transparent").
- Live Pages: https://jfeldman9-rgb.github.io/whale-lance-buffet-brawl/
- Cache-bust query on scripts/styles in `index.html` is currently `?v=20260922-controls2`. Bump that string whenever shipping JS/CSS changes so returning players get the new files.

## 2. ChatGPT updates already on `main` — keep these behaviors

These landed after the Cursor arcade graphics merge; do not regress them:

- Native phone/Retina DPR rendering; Classic 640×360 mode still available via Pause → Display.
- Press Start 2P font + Pages workflow + `tools/verify-hd.cjs` exist — don't delete them.
- BOX / on-screen controls must stay clickable with a desktop mouse: pointer handling routes mouse input through the touch buttons during play. Do not revert to click-only handling.
- Combat overlays / control plates must stay largely transparent so enemies behind them remain visible (low-alpha plates and button fills).
- Toolbox button shows PICK UP when the player has no toolbox; pass `hasToolbox` into `drawTouch`.
- Sticky on-screen control picture stays for the whole fight (not tutorial-timer gated).

## 3. Stack history (for context)

- Sticky controls (PR #3) → arcade graphics 8-pack (PR #4) → ChatGPT HD/publish (PR #5) → cache bump (`cded501`) → BOX controls + transparent overlays (`1094027`).
- Prefer additive polish; do not regress the layers above. Avoid touching `js/input.js` / `js/scenes.js` gameplay or graphics unless a tiny change is strictly required.

## 4. Repo notes

- Static GitHub Pages game — keep `.nojekyll` in place.
