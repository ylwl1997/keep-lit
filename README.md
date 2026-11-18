# Keep Lit

Cup a candle and walk a dark house. Hold to shield the flame; jump, vault, crawl, or run when the house demands it. Release in calm air so the flame can recover.

This DEMO is a single long hall. Procedural placeholder art, no audio yet.

## Play

- **Cup** (hold): Space, F, or the Cup button — shields the flame but slows your walk.
- **Jump / Vault** (press): W, ↑, or Jump — hop a floor gap, or vault a waist-high chest when in range.
- **Crawl** (hold): S, ↓, or Crawl — slow but stable; slip under a low soffit.
- **Run** (hold): Shift or Run — faster through calm stretches and closing doors; the flame is more vulnerable.

Flame-out, falling into a gap, or a slammed door restarts in place (“The flame went out.” / “The door closed.”). There is **no** whole-run time-limit fail, and there are **no** mid-run checkpoints.

## Score

HUD shows **Score**, **Best**, the flame bar, and **elapsed** time (count-up, `M:SS`).

- Obstacle clears (once each): gap jump **+200**, vault **+150**, crawl **+150**, closing door **+250**
- Leave the hall with flame ≥ 80: **+50**
- On a full win: remaining flame × **10**, plus time bonus `max(0, (90 − elapsedSeconds) × 8)` (90 is a scoring reference only)
- **Best** is stored in `localStorage` key `keep-lit-best-score`, only after a full run from the start (not `?room=` DEV jumps)

## The Hall

One long room, beats spaced so each verb is obvious:

1. Waist-high chest — vault (first-time “Jump” hint)
2. Broken floorboards — jump the gap
3. Draft corridor — cup the flame through the wind
4. Soffit with a clear crawl mouth — hold Crawl (first-time “Hold Crawl” hint)
5. Closing door — sprint through before it seals
6. Lit doorway — the house is still lit

Local preview: `npm install && npm run dev` then open http://127.0.0.1:5175/ (not localhost).

DEV: `?room=0` auto-starts at the beginning of the hall. Closing-door spawn still sits before `triggerX`.
