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
  | "longHall"
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

export const ROOM_DEFS: RoomDef[] = [
  {
    name: "The Hall",
    width: 4200,
    kind: "longHall",
    // One readable draft corridor after the jump gap. Cup is required; sprint is for the door.
    hazards: [{ kind: "draft", x: 1480, w: 860, strength: 0.52, dir: RIGHT }],
    obstacles: [
      // Calm teach beats first, spaced so each silhouette is obvious.
      { kind: "vault", x: 520, w: 140, h: 82 },
      { kind: "gap", x: 1120, w: 122 },
      { kind: "crawl", x: 2580, w: 200, clearance: 76 },
      // Same trigger-to-passage margin as the old Kitchen Door: walk cannot clear, sprint can.
      {
        kind: "closingDoor",
        x: 3480,
        openW: 96,
        triggerX: 3050,
        closeTime: 2.45,
      },
    ],
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

/** Stable id for scoring a successful clear once per run. */
export function obstacleId(roomIndex: number, obs: Obstacle): string {
  return `${roomIndex}:${obs.kind}:${Math.round(obs.x)}`;
}
