import { CALM_THRESHOLD, FLOOR_Y, RECOVER_RATE } from "./constants";
import type { BakedRoom, Hazard, Vec2 } from "./rooms";

export type WindSample = {
  strength: number;
  dx: number;
  dy: number;
  rain: number;
};

export type GustState = Record<string, { openedAt: number | null }>;

function inSpan(localX: number, x: number, w: number): number {
  if (localX < x || localX > x + w) return 0;
  const edge = Math.min(40, w * 0.18);
  if (localX < x + edge) return (localX - x) / edge;
  if (localX > x + w - edge) return (x + w - localX) / edge;
  return 1;
}

function addWind(
  acc: { sx: number; sy: number; max: number; sum: number; rain: number },
  strength: number,
  dir: Vec2,
  rain = 0,
): void {
  if (strength <= 0.001) return;
  acc.sum += strength;
  acc.max = Math.max(acc.max, strength);
  acc.sx += dir.x * strength;
  acc.sy += dir.y * strength;
  acc.rain = Math.max(acc.rain, rain);
}

export function fanAngle(hazard: Extract<Hazard, { kind: "fan" }>, timeSec: number): number {
  return Math.sin((timeSec / hazard.period) * Math.PI * 2) * hazard.sweep;
}

export function periodicActive(
  hazard: Extract<Hazard, { kind: "periodic" }>,
  timeSec: number,
): number {
  const t = ((timeSec + hazard.phase) % hazard.period) / hazard.period;
  if (t > hazard.duty) return 0;
  const rise = 0.12;
  const u = t / hazard.duty;
  if (u < rise) return u / rise;
  if (u > 1 - rise) return (1 - u) / rise;
  return 1;
}

export function gustEnvelope(
  hazard: Extract<Hazard, { kind: "approachGust" }>,
  openedAt: number | null,
  timeSec: number,
): { open: number; wind: number } {
  if (openedAt === null) return { open: 0, wind: 0 };
  const elapsed = timeSec - openedAt;
  const open = Math.max(0, Math.min(1, elapsed / hazard.openTime));
  if (open < 0.35) return { open, wind: 0 };
  const after = elapsed - hazard.openTime;
  if (after <= hazard.burstTime) return { open, wind: 1 };
  const decay = Math.max(hazard.linger, 1 - (after - hazard.burstTime) / 1.8);
  return { open, wind: decay };
}

export function updateGusts(
  rooms: BakedRoom[],
  playerX: number,
  timeSec: number,
  state: GustState,
): void {
  for (const room of rooms) {
    for (const hazard of room.hazards) {
      if (hazard.kind !== "approachGust") continue;
      const cur = state[hazard.id] ?? { openedAt: null };
      if (cur.openedAt === null) {
        const local = playerX - room.worldX;
        if (local >= hazard.triggerX && local <= hazard.triggerX + hazard.triggerRange) {
          cur.openedAt = timeSec;
        }
      }
      state[hazard.id] = cur;
    }
  }
}

export function sampleWind(
  rooms: BakedRoom[],
  playerX: number,
  timeSec: number,
  state: GustState,
): WindSample {
  const acc = { sx: 0, sy: 0, max: 0, sum: 0, rain: 0 };
  const chestY = FLOOR_Y - 96;

  for (const room of rooms) {
    const local = playerX - room.worldX;
    if (local < -40 || local > room.width + 40) continue;

    for (const hazard of room.hazards) {
      switch (hazard.kind) {
        case "draft":
        case "chimney": {
          const cover = inSpan(local, hazard.x, hazard.w);
          addWind(acc, hazard.strength * cover, hazard.dir);
          break;
        }
        case "periodic": {
          const cover = inSpan(local, hazard.x, hazard.w) * periodicActive(hazard, timeSec);
          addWind(acc, hazard.strength * cover, hazard.dir);
          break;
        }
        case "approachGust": {
          const env = gustEnvelope(hazard, state[hazard.id]?.openedAt ?? null, timeSec);
          const cover = inSpan(local, hazard.gustX, hazard.gustW) * env.wind;
          addWind(acc, hazard.strength * cover, hazard.dir);
          break;
        }
        case "rain": {
          const cover = inSpan(local, hazard.x, hazard.w);
          addWind(acc, hazard.strength * cover, { x: 0.15, y: 1 }, cover);
          break;
        }
        case "vent": {
          const cover = inSpan(local, hazard.x, hazard.w);
          addWind(acc, hazard.strength * cover, { x: 0, y: -1 });
          break;
        }
        case "fan": {
          const fanX = room.worldX + hazard.x;
          const fanY = FLOOR_Y - 72;
          const dx = playerX - fanX;
          const dy = chestY - fanY;
          const dist = Math.hypot(dx, dy);
          if (dist >= hazard.reach || dist < 4) break;
          const heading = fanAngle(hazard, timeSec);
          const ang = Math.atan2(dy, dx);
          let diff = ang - heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) >= hazard.cone) break;
          const edge = 1 - Math.abs(diff) / hazard.cone;
          const falloff = 1 - dist / hazard.reach;
          const s = hazard.strength * Math.pow(edge, 0.7) * Math.pow(falloff, 0.85);
          addWind(acc, s, { x: Math.cos(heading), y: Math.sin(heading) });
          break;
        }
        default:
          break;
      }
    }
  }

  const strength = Math.min(1.15, acc.max + Math.max(0, acc.sum - acc.max) * 0.7);
  const mag = Math.hypot(acc.sx, acc.sy);
  let dx = 0;
  let dy = 0;
  if (mag > 0.08) {
    dx = acc.sx / mag;
    dy = acc.sy / mag;
  } else if (strength > 0.2) {
    dx = 0;
    dy = -0.35;
  }

  return { strength, dx, dy, rain: acc.rain };
}

export function flameDelta(cupped: boolean, wind: WindSample, dt: number): number {
  const s = wind.strength;
  if (s <= CALM_THRESHOLD) {
    if (cupped) return 0;
    const ease = 1 - (s / CALM_THRESHOLD) * 0.45;
    return RECOVER_RATE * ease * dt;
  }
  if (cupped) return -(2.2 + 10 * s) * dt;
  return -(50 * s) * dt;
}
