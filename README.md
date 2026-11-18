# Keep Lit

Cup a candle and walk a dark house. Hold to shield the flame; jump, vault, crawl, or run when the house demands it. Release in calm air so the flame can recover.

This is a 12-room vertical slice. Procedural placeholder art, no audio yet.

## Play

- **Cup** (hold): Space, F, or the Cup button — shields the flame but slows your walk.
- **Jump / Vault** (press): W, ↑, or Jump — hop a floor gap, or vault a waist-high chest/sofa/cabinet when in range.
- **Crawl** (hold): S, ↓, or Crawl — slow but stable; slip under low beams.
- **Run** (hold): Shift or Run — faster through calm stretches; the flame is more vulnerable.

Flame-out, falling into a gap, or a slammed door restarts in place (“The flame went out.” / “The door closed.”). There is **no** whole-run time-limit fail.

## Score

HUD shows **Score**, **Best**, the flame bar, and **elapsed** time (count-up, `M:SS`).

- Obstacle clears (once each): gap jump **+200**, vault **+150**, crawl **+150**, closing door **+250**
- Leave a room with flame ≥ 80: **+50**
- On a full win: remaining flame × **10**, plus time bonus `max(0, (90 − elapsedSeconds) × 8)` (90 is a scoring reference only)
- **Best** is stored in `localStorage` key `keep-lit-best-score`, only after a full run from the start (not `?room=` DEV jumps)

## Rooms (obstacles)

Every room except Quiet Landing has a mandatory gate. The first vault is in the Foyer after a short cup-teach stretch.

Local preview: `npm install && npm run dev` then open http://127.0.0.1:5175/ (not localhost).

DEV: `?room=N` (0–11) auto-starts in that room. Closing-door rooms spawn before `triggerX`.
