/** Canvas design size (CSS pixels). Simulation stays in the original 2D pixel units. */
export const GAME_W = 1280;
export const GAME_H = 800;

/** 100 px = 1 world unit. STAND_HEAD 148px ≈ 1.48 units. */
export const PX_TO_WORLD = 0.01;

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
/** Fail banner hold so score under it is readable. Presentation only. */
export const FAIL_BEAT = 2.0;
/** Jump / crawl presses during a landing are remembered this long. */
export const INPUT_BUFFER = 0.2;
/**
 * Closing-door squeeze width in pixels. Sprint reaches the Kitchen Door
 * margin with about 26px still open; a walk arrives after the seal.
 */
export const DOOR_SQUEEZE = 18;
/** Scoring reference only — not a fail line. */
export const SCORE_TIME_REF = 90;
export const BEST_SCORE_KEY = "keep-lit-best-score";
export const HINT_JUMP_KEY = "keep-lit-hint-jump";
export const HINT_CRAWL_KEY = "keep-lit-hint-crawl";

export const FONT_STACK =
  'Fraunces, "EB Garamond", "Source Serif 4", "Source Serif Pro", Georgia, "Palatino Linotype", Palatino, "Times New Roman", serif';

/** Style-guide palette (hex numbers for Three.js, strings for DOM). */
export const C = {
  soot: 0x12100e,
  plasterShadow: 0x1c1713,
  plaster: 0x2c241c,
  plasterLit: 0x4a3a2c,
  woodDeep: 0x2a1810,
  wood: 0x5a3a24,
  woodMid: 0x6e4a2e,
  woodLit: 0x8a6240,
  floor: 0x3a2618,
  floorLit: 0x4e3422,
  floorVoid: 0x0a0808,
  curtain: 0x5a3040,
  curtainShadow: 0x3a1c28,
  curtainLit: 0x7a4858,
  nightDeep: 0x0e1624,
  nightMid: 0x1a2838,
  moonlight: 0x8aa4be,
  moonFill: 0x4a6080,
  metal: 0x4a4c50,
  metalLit: 0x8a8c90,
  copper: 0x8a5a32,
  copperLit: 0xc4894a,
  copperDeep: 0x4a2c16,
  flameCore: 0xfff6d8,
  flameMid: 0xffd27a,
  flame: 0xff9a3c,
  flameDeep: 0xe06018,
  flameBounce: 0xffb060,
  coat: 0x1e1a18,
  coatRim: 0x5a4030,
  pants: 0x141210,
  skin: 0xc4a07a,
  hair: 0x1a1210,
  ink: 0x140f0a,
  panelSoot: 0x1a1410,
  panelWood: 0x2a1c14,
  fog: 0x12141a,
  ambient: 0x1a1418,
  text: "#f4e6c5",
  textGold: "#ffd27a",
  textDim: "#c4b090",
  textMute: "#7a6a52",
} as const;
