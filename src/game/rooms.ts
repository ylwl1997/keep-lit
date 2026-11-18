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
  },
  {
    name: "Kitchen Door",
    width: 960,
    kind: "kitchen",
    hazards: [
      {
        kind: "approachGust",
        id: "kitchen-door",
        triggerX: 300,
        triggerRange: 260,
        gustX: 320,
        gustW: 280,
        strength: 0.85,
        dir: LEFT,
        openTime: 0.32,
        burstTime: 0.7,
        linger: 0.05,
      },
    ],
  },
  {
    name: "Leaky Ceiling",
    width: 1140,
    kind: "leaky",
    hazards: [{ kind: "rain", x: 260, w: 640, strength: 0.62 }],
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
  },
  {
    name: "Stairwell",
    width: 1480,
    kind: "stairwell",
    hazards: [
      { kind: "chimney", x: 60, w: 500, strength: 0.7, dir: CHIMNEY_DIR },
      { kind: "chimney", x: 800, w: 620, strength: 0.76, dir: CHIMNEY_DIR },
    ],
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
