import { PX_TO_WORLD } from "./constants";

/** Convert a simulation (pixel) length or position to world units. */
export function wu(px: number): number {
  return px * PX_TO_WORLD;
}

export function formatScore(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString("en-US");
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
