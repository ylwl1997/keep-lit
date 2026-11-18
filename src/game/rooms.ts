export type Vec2 = { x: number; y: number };

export type Hazard =
  | {
      kind: "draft";
      x: number;
      w: number;
      strength: number;
      dir: Vec2;
    }
  | {
      kind: "periodic";
      x: number;
      w: number;
      strength: number;
      dir: Vec2;
      period: number;
      duty: number;
      phase: number;
    }
  | {
      kind: "approachGust";
      id: string;
      triggerX: number;
      triggerRange: number;
      gustX: number;
      gustW: number;
      strength: number;
      dir: Vec2;
      openTime: number;
      burstTime: number;
      linger: number;
    }
  | {
      kind: "fan";
      x: number;
      strength: number;
      reach: number;
      period: number;
      cone: number;
      sweep: number;
    }
  | {
      kind: "rain";
      x: number;
      w: number;
      strength: number;
    }
  | {
      kind: "vent";
      x: number;
      w: number;
      strength: number;
    }
  | {
      kind: "chimney";
      x: number;
      w: number;
      strength: number;
      dir: Vec2;
    };

/** Physical blockers / timed gates that force jump, vault, crawl, or sprint. */
export type Obstacle =
  | {
      kind: "vault";
      /** Local left edge of the blocker. */
      x: number;
      w: number;
      /** Height above floor; waist-high furniture. */
      h: number;
    }
  | {
      kind: "crawl";
      x: number;
      w: number;
      /** Max standing clearance from floor; must duck under. */
      clearance: number;
    }
  | {
      kind: "gap";
      x: number;
      w: number;
    }
  | {
      kind: "closingDoor";
      /** Door frame local x (left of gap). */
      x: number;
      /** Passage width when fully open. */
      openW: number;
      /** Local x where the close clock starts. */
      triggerX: number;
      /** Seconds from trigger until the door seals. */
      closeTime: number;
    };

export type RoomKind =
  | "foyer"
  | "hall"
  | "frontDoor"
  | "fan"
  | "curtains"
  | "kitchen"
  | "leaky"
  | "cross"
  | "attic"
  | "stairwell"
  | "storm"
  | "landing";

export type RoomDef = {
  name: string;
  width: number;
  kind: RoomKind;
  hazards: Hazard[];
  obstacles?: Obstacle[];
};

export type BakedRoom = RoomDef & { worldX: number; index: number };

const RIGHT: Vec2 = { x: 1, y: 0 };
const LEFT: Vec2 = { x: -1, y: 0 };
const UP: Vec2 = { x: 0, y: -1 };
const CHIMNEY_DIR: Vec2 = { x: 0.4, y: -0.9 };

export const ROOM_DEFS: RoomDef[] = [
  {
    name: "Foyer",
    width: 980,
    kind: "foyer",
    hazards: [{ kind: "draft", x: 500, w: 300, strength: 0.32, dir: RIGHT }],
  },
  {
    name: "Hall Draft",
    width: 1080,
    kind: "hall",
    hazards: [{ kind: "draft", x: 40, w: 980, strength: 0.48, dir: RIGHT }],
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
    // Mid-path sofa: must vault; fan exposure during vault is the tradeoff.
    obstacles: [{ kind: "vault", x: 430, w: 120, h: 82 }],
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
    // Low beam / half-dropped shutter: standing blocked, crawl clears.
    obstacles: [{ kind: "crawl", x: 520, w: 200, clearance: 78 }],
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
    // Broken boards / wide puddle gap — must jump.
    obstacles: [{ kind: "gap", x: 470, w: 78 }],
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
  },
  {
    name: "Attic Vent",
    width: 1000,
    kind: "attic",
    hazards: [{ kind: "vent", x: 360, w: 300, strength: 0.7 }],
    // Low soffit / stacked crates arch — reinforce crawl under drafts.
    obstacles: [{ kind: "crawl", x: 400, w: 160, clearance: 82 }],
  },
  {
    name: "Stairwell",
    width: 1480,
    kind: "stairwell",
    hazards: [
      { kind: "chimney", x: 60, w: 500, strength: 0.7, dir: CHIMNEY_DIR },
      { kind: "chimney", x: 800, w: 620, strength: 0.76, dir: CHIMNEY_DIR },
    ],
    // Missing floorboards on the walk — second jump.
    obstacles: [{ kind: "gap", x: 700, w: 74 }],
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
  },
  {
    name: "Quiet Landing",
    width: 1080,
    kind: "landing",
    hazards: [{ kind: "draft", x: 740, w: 260, strength: 0.38, dir: RIGHT }],
  },
];

export type HouseLayout = {
  rooms: BakedRoom[];
  width: number;
};

export function bakeHouse(): HouseLayout {
  let x = 0;
  const rooms: BakedRoom[] = ROOM_DEFS.map((room, index) => {
    const baked: BakedRoom = { ...room, worldX: x, index };
    x += room.width;
    return baked;
  });
  return { rooms, width: x };
}

export function roomAt(rooms: BakedRoom[], worldX: number): BakedRoom {
  for (let i = rooms.length - 1; i >= 0; i--) {
    if (worldX >= rooms[i].worldX) return rooms[i];
  }
  return rooms[0];
}
