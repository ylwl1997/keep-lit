export const GAME_W = 1280;
export const GAME_H = 800;
export const FLOOR_Y = 628;
export const CEILING_Y = 88;
export const WAINSCOT_Y = 438;
export const START_OFFSET = 220;
export const EXIT_MARGIN = 88;
export const WALK_SPEED = 148;
export const CUP_SPEED_MUL = 0.64;
export const SPRINT_MUL = 1.62;
export const CRAWL_MUL = 0.5;
export const JUMP_V0 = 500;
export const GRAVITY = 1280;
export const VAULT_DURATION = 0.42;
export const VAULT_HEIGHT = 78;
export const STAND_CHEST = 96;
export const CRAWL_CHEST = 46;
export const CRAWL_HEAD = 70;
export const STAND_HEAD = 148;
export const FLAME_MAX = 100;
export const RECOVER_RATE = 26;
export const CALM_THRESHOLD = 0.06;
/** Fail banner hold so score under it is readable. */
export const FAIL_BEAT = 1.05;
/** Scoring reference only — not a fail line. */
export const SCORE_TIME_REF = 90;
export const BEST_SCORE_KEY = "keep-lit-best-score";
export const FONT = 'Georgia, "Palatino Linotype", Palatino, "Times New Roman", serif';
export const UI_FONT = "system-ui, 'Segoe UI', sans-serif";

export const C = {
  bgTop: 0x120e0c,
  bgMid: 0x1a1410,
  bgWarm: 0x221810,
  wood: 0x5c3a22,
  woodMid: 0x4a2e1c,
  woodDark: 0x3a2416,
  woodDeep: 0x2a1a10,
  trim: 0x6a4530,
  trimLite: 0x7a5640,
  floor: 0x24180f,
  floorLite: 0x2e2016,
  flameCore: 0xfff6d8,
  flameMid: 0xffe7b0,
  flame: 0xffb15a,
  flameDeep: 0xff7a2a,
  skin: 0xb8926c,
  coat: 0x2b2420,
  coatLite: 0x3a332e,
  pants: 0x1a1614,
  hair: 0x1c1410,
  night: 0x151c28,
  nightLite: 0x243044,
  moon: 0x8aa0b8,
  curtain: 0x4a2c38,
  curtainLite: 0x5c3844,
  metal: 0x3a3a40,
  metalLite: 0x5a5a62,
  text: "#f4e6c5",
  textDim: "#d4c4a0",
  textMute: "#9a8a70",
  ink: "#140f0a",
} as const;
