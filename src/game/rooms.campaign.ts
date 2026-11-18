/** Archived 12-room campaign. Not imported by the current single-room DEMO. */
import type { RoomDef, Vec2 } from "./rooms";

const RIGHT: Vec2 = { x: 1, y: 0 };
const LEFT: Vec2 = { x: -1, y: 0 };
const UP: Vec2 = { x: 0, y: -1 };
const CHIMNEY_DIR: Vec2 = { x: 0.4, y: -0.9 };

export const CAMPAIGN_ROOM_DEFS: RoomDef[] = [
  {
    name: "Foyer",
    width: 980,
    kind: "foyer",
    hazards: [{ kind: "draft", x: 500, w: 300, strength: 0.32, dir: RIGHT }],
    // Short cup-teach stretch, then a solid chest/table across the walk line.
    obstacles: [{ kind: "vault", x: 500, w: 140, h: 82 }],
  },
  {
    name: "Hall Draft",
    width: 1080,
    kind: "hall",
    hazards: [{ kind: "draft", x: 40, w: 980, strength: 0.48, dir: RIGHT }],
    // Mid-hall low shutter / beam — crawl is stable, standing blocked.
    obstacles: [{ kind: "crawl", x: 470, w: 200, clearance: 76 }],
  },
  {
    name: "Front Door",
    width: 960,
    kind: "frontDoor",
    hazards: [
      {
        kind: "approachGust",
        id: "front-door",
        triggerX: 280,
        triggerRange: 300,
        gustX: 300,
        gustW: 340,
        strength: 0.92,
        dir: RIGHT,
        openTime: 0.45,
        burstTime: 1.2,
        linger: 0.2,
      },
    ],
    // Broken threshold past the open door — jump while the gust is still alive.
    obstacles: [{ kind: "gap", x: 520, w: 118 }],
  },
  {
    name: "Fan Room",
    width: 1120,
    kind: "fan",
    hazards: [
      {
        kind: "fan",
        x: 560,
        strength: 0.78,
        reach: 430,
        period: 2.8,
        cone: 0.46,
        sweep: 1.12,
      },
    ],
    // Only sofa on the walk line — must vault; fan exposure is the tradeoff.
    obstacles: [{ kind: "vault", x: 430, w: 132, h: 84 }],
  },
  {
    name: "Curtain Corridor",
    width: 1180,
    kind: "curtains",
    hazards: [
      {
        kind: "periodic",
        x: 80,
        w: 1020,
        strength: 0.55,
        dir: RIGHT,
        period: 1.85,
        duty: 0.44,
        phase: 0.1,
      },
    ],
    // Heavy beam with a clear crawl mouth.
    obstacles: [{ kind: "crawl", x: 520, w: 210, clearance: 78 }],
  },
  {
    name: "Kitchen Door",
    width: 1040,
    kind: "kitchen",
    hazards: [
      {
        kind: "approachGust",
        id: "kitchen-door",
        triggerX: 260,
        triggerRange: 240,
        gustX: 300,
        gustW: 260,
        strength: 0.72,
        dir: LEFT,
        openTime: 0.28,
        burstTime: 0.55,
        linger: 0.05,
      },
    ],
    // Closing pantry door: walk-speed cannot clear once the clock starts.
    obstacles: [
      {
        kind: "closingDoor",
        x: 520,
        openW: 96,
        triggerX: 90,
        closeTime: 2.45,
      },
    ],
  },
  {
    name: "Leaky Ceiling",
    width: 1140,
    kind: "leaky",
    hazards: [{ kind: "rain", x: 260, w: 640, strength: 0.62 }],
    // Wide broken-board pit — must jump.
    obstacles: [{ kind: "gap", x: 460, w: 124 }],
  },
  {
    name: "Cross Breeze",
    width: 1160,
    kind: "cross",
    hazards: [
      { kind: "draft", x: 120, w: 520, strength: 0.5, dir: RIGHT },
      { kind: "draft", x: 500, w: 520, strength: 0.5, dir: LEFT },
      { kind: "draft", x: 480, w: 220, strength: 0.28, dir: UP },
    ],
    // Chest across the crossing drafts — exposed while vaulting.
    obstacles: [{ kind: "vault", x: 530, w: 128, h: 80 }],
  },
  {
    name: "Attic Vent",
    width: 1000,
    kind: "attic",
    hazards: [{ kind: "vent", x: 360, w: 300, strength: 0.7 }],
    // Low soffit under the vent — crawl through the mouth.
    obstacles: [{ kind: "crawl", x: 390, w: 180, clearance: 80 }],
  },
  {
    name: "Stairwell",
    width: 1480,
    kind: "stairwell",
    hazards: [
      { kind: "chimney", x: 60, w: 500, strength: 0.7, dir: CHIMNEY_DIR },
      { kind: "chimney", x: 800, w: 620, strength: 0.76, dir: CHIMNEY_DIR },
    ],
    // Wide missing boards after the mid landing.
    obstacles: [{ kind: "gap", x: 880, w: 122 }],
  },
  {
    name: "Storm Window",
    width: 1240,
    kind: "storm",
    hazards: [
      {
        kind: "periodic",
        x: 160,
        w: 680,
        strength: 0.9,
        dir: { x: 0.85, y: 0.2 },
        period: 1.8,
        duty: 0.38,
        phase: 0.2,
      },
    ],
    // Fallen cabinet in the gust — one house-fitting gate, not a rhythm rail.
    obstacles: [{ kind: "vault", x: 560, w: 136, h: 86 }],
  },
  {
    name: "Quiet Landing",
    width: 1080,
    kind: "landing",
    hazards: [{ kind: "draft", x: 740, w: 260, strength: 0.38, dir: RIGHT }],
  },
];
