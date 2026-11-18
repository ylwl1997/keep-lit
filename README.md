# Keep Lit

Cup a candle and walk a dark hall. Hold to shield the flame; jump, vault, crawl, or run when the house demands it. Release in calm air so the flame can recover.

This demo is **one long room** — The Hall — built as a stylized real-time side view in Three.js. It is the playable slice for locking gameplay: auto-walk, cup, jump, vault, crawl, sprint, and one draft corridor. Procedural geometry only. No audio yet.

## Play

Local preview: `npm install && npm run dev`, then open http://127.0.0.1:5175/ (port 5175, host `127.0.0.1`, not `localhost`).

- **Cup** (hold): Space, F, or the Cup button — shields the flame and slows the walk (×0.64) unless you are sprinting.
- **Jump / Vault** (press): W, ↑, or Jump — hop the broken floor, or vault the waist-high chest when you are in range.
- **Crawl** (hold): S, ↓, or Crawl — half speed, low enough for the soffit. A press in the last moment of a jump still counts once you land.
- **Run** (hold): Shift or Run — ×1.62 through calm air. The flame is more exposed. Sprint is what clears the closing door; a walk does not.

The candle is the only key light. Failures restart at the start of the hall. There is no checkpoint and no time-limit fail.

Copy stays fixed: “The flame went out.” / “The door closed.” / “The house is still lit.” The fail line holds for 2 seconds so the score can be read.

The first time you approach the chest, a short “Jump” hint appears. The first time you approach the crawl mouth, “Hold Crawl” appears. Each one goes away after you clear that beat.

## The Hall

Width 4200. HUD name **The Hall**. In order:

1. Calm start, then a waist-high chest (vault).
2. Broken floorboards (jump). Any chest nearby is against the back wall, off the walk line.
3. Draft corridor. Cup to keep the flame. Curtains in this stretch move; they are not placed on later obstacles.
4. A soffit dropped from the ceiling, with a dark rectangular mouth (crawl).
5. A closing door. Walk cannot clear it; sprint can.
6. A short calm and a glowing exit. Reaching it with the flame still lit wins.

## Score

The lintel shows **Score**, **Best**, the flame lantern, and elapsed time (`M:SS`).

- Obstacle clears, once each: gap **+200**, vault **+150**, crawl **+150**, closing door **+250**
- Leave the hall with flame ≥ 80: **+50** (this is the Flame line, not Obstacles)
- On a full win: remaining flame × **10**, plus time bonus `max(0, (90 − elapsedSeconds) × 8)`. 90 is a scoring reference only.
- **Best** is `localStorage` key `keep-lit-best-score`, written only after a full run from the start. A DEV `?room=` start never writes it and does not score obstacles behind the spawn.

## Build

`npm run build` typechecks and emits `dist/` with `base: "./"`. The same build plays when the CrazyGames SDK is missing or disabled (GitHub Pages). SDK init never blocks the first frame; a failure shows a warning and the hall still runs.

Preview the production bundle with `npm run preview` at http://127.0.0.1:4175/.

DEV only: `?room=0` auto-starts in The Hall. The query is ignored in production builds.
