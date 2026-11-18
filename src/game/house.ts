import * as THREE from "three";
import { C } from "./constants";
import { wu } from "./scale";
import { makeMaterial, type GameTextures } from "./textures";
import type { BakedRoom, HouseLayout, Obstacle } from "./rooms";

const WALL_Z = -2.15;
const FLOOR_Z0 = -2.2;
const FLOOR_Z1 = 1.15;
const FLOOR_DEPTH = FLOOR_Z1 - FLOOR_Z0;
const FLOOR_Z = (FLOOR_Z0 + FLOOR_Z1) / 2;
const CEIL_Y = 3.35;
const WALL_H = 3.5;
const THICK = 0.2;

export type DoorVisual = {
  key: string;
  pivot: THREE.Group;
  roomIndex: number;
  obs: Extract<Obstacle, { kind: "closingDoor" }>;
};

export type FanVisual = {
  blades: THREE.Group;
  period: number;
  sweep: number;
};

export type WindowLight = {
  x: number;
  y: number;
  z: number;
};

export class House {
  readonly group = new THREE.Group();
  readonly doors: DoorVisual[] = [];
  readonly fans: FanVisual[] = [];
  readonly curtains: THREE.Object3D[] = [];
  readonly windows: WindowLight[] = [];
  private readonly mats: ReturnType<typeof buildMaterials>;

  constructor(layout: HouseLayout, textures: GameTextures) {
    this.mats = buildMaterials(textures);
    const voidGeom = new THREE.BoxGeometry(wu(layout.width) + 8, 6, 8);
    const voidMesh = new THREE.Mesh(voidGeom, this.mats.voidMat);
    voidMesh.position.set(wu(layout.width) * 0.5, -3.2, 0);
    voidMesh.receiveShadow = true;
    this.group.add(voidMesh);

    for (const room of layout.rooms) this.buildRoom(room);
  }

  update(timeSec: number, doorOpen: (key: string, closeTime: number) => number): void {
    for (const door of this.doors) {
      const open = doorOpen(door.key, door.obs.closeTime);
      // Fully open = swung back; closed = flush in the frame.
      door.pivot.rotation.y = -open * (Math.PI * 0.5);
    }
    for (const fan of this.fans) {
      fan.blades.rotation.z = Math.sin((timeSec / fan.period) * Math.PI * 2) * fan.sweep;
    }
    for (const c of this.curtains) {
      const sway = typeof c.userData.sway === "number" ? c.userData.sway : 0.06;
      c.rotation.y = Math.sin(timeSec * (sway > 0.1 ? 2.4 : 1.3) + c.position.x) * sway;
    }
  }

  private buildRoom(room: BakedRoom): void {
    const x0 = wu(room.worldX);
    const w = wu(room.width);
    const mid = x0 + w * 0.5;

    this.floorFor(room);
    this.walls(room, x0, w, mid);
    this.ceilingBeams(room, x0, w);
    this.wainscot(x0, w);
    this.baseboard(x0, w);
    this.partition(room, x0);
    this.dressing(room, x0, w, mid);
    this.obstacles(room);
    this.hazards(room, x0, w, mid);
    if (room.kind === "longHall") this.endCap(x0 + w - 0.15);
  }

  private floorFor(room: BakedRoom): void {
    const gaps = (room.obstacles ?? []).filter(
      (o): o is Extract<Obstacle, { kind: "gap" }> => o.kind === "gap",
    );
    const x0 = room.worldX;
    const x1 = room.worldX + room.width;
    const spans: Array<[number, number]> = [];
    let cursor = x0;
    const sorted = [...gaps].sort((a, b) => a.x - b.x);
    for (const g of sorted) {
      const left = room.worldX + g.x;
      const right = left + g.w;
      if (left - cursor > 8) spans.push([cursor, left]);
      this.gapPiece(room, g);
      cursor = right;
    }
    if (x1 - cursor > 8) spans.push([cursor, x1]);
    if (spans.length === 0 && gaps.length === 0) spans.push([x0, x1]);
    for (const [a, b] of spans) {
      const ww = wu(b - a);
      const floor = box(ww, THICK, FLOOR_DEPTH, this.mats.floor, wu((a + b) / 2), -THICK / 2, FLOOR_Z);
      floor.receiveShadow = true;
      this.group.add(floor);
    }
  }

  private gapPiece(room: BakedRoom, obs: Extract<Obstacle, { kind: "gap" }>): void {
    const left = wu(room.worldX + obs.x);
    const ww = wu(obs.w);
    const mid = left + ww * 0.5;
    const pit = box(ww + 0.15, 2.4, FLOOR_DEPTH + 0.2, this.mats.voidMat, mid, -1.3, FLOOR_Z);
    this.group.add(pit);

    // Broken board thickness and splintered edges that catch candlelight.
    for (const side of [-1, 1]) {
      const edgeX = mid + side * (ww * 0.5);
      const lip = box(0.12, 0.1, FLOOR_DEPTH * 0.92, this.mats.floorLit, edgeX - side * 0.02, 0.02, FLOOR_Z);
      lip.castShadow = true;
      lip.receiveShadow = true;
      this.group.add(lip);
      for (let i = 0; i < 4; i++) {
        const z = FLOOR_Z0 + 0.25 + i * 0.55;
        const len = 0.18 + (i % 2) * 0.12;
        const sliver = box(len, 0.07, 0.1, this.mats.woodLit, edgeX + side * len * 0.35, 0.0, z);
        sliver.rotation.z = side * (0.15 + i * 0.05);
        sliver.castShadow = true;
        this.group.add(sliver);
      }
    }
    // Joists under the break.
    for (const z of [-1.4, -0.4, 0.5]) {
      const joist = box(ww + 0.2, 0.08, 0.1, this.mats.woodDeep, mid, -0.22, z);
      this.group.add(joist);
    }
  }

  private walls(room: BakedRoom, x0: number, w: number, mid: number): void {
    const back = box(w + 0.08, WALL_H, 0.16, this.mats.plaster, mid, WALL_H / 2 - 0.02, WALL_Z);
    back.receiveShadow = true;
    this.group.add(back);

    const windows = windowPlan(room);
    for (const win of windows) {
      this.windowAt(x0 + wu(win.localX), win.w, win.h, win.sill);
    }
  }

  private windowAt(cx: number, w: number, h: number, sill: number): void {
    const frame = this.mats.wood;
    const night = this.mats.night;
    const glass = this.mats.glass;
    const recess = box(w, h, 0.12, night, cx, sill + h / 2, WALL_Z + 0.06);
    this.group.add(recess);
    const pane = box(w - 0.1, h - 0.1, 0.02, glass, cx, sill + h / 2, WALL_Z + 0.14);
    this.group.add(pane);
    // Mullions and frame.
    this.group.add(box(w + 0.08, 0.08, 0.1, frame, cx, sill, WALL_Z + 0.16));
    this.group.add(box(w + 0.08, 0.08, 0.1, frame, cx, sill + h, WALL_Z + 0.16));
    this.group.add(box(0.08, h + 0.08, 0.1, frame, cx - w / 2, sill + h / 2, WALL_Z + 0.16));
    this.group.add(box(0.08, h + 0.08, 0.1, frame, cx + w / 2, sill + h / 2, WALL_Z + 0.16));
    this.group.add(box(0.05, h - 0.08, 0.04, frame, cx, sill + h / 2, WALL_Z + 0.17));
    this.group.add(box(w - 0.08, 0.05, 0.04, frame, cx, sill + h * 0.5, WALL_Z + 0.17));
    this.windows.push({ x: cx, y: sill + h * 0.55, z: WALL_Z + 0.3 });
  }

  private ceilingBeams(room: BakedRoom, x0: number, w: number): void {
    const crawlSpans = (room.obstacles ?? [])
      .filter((o): o is Extract<Obstacle, { kind: "crawl" }> => o.kind === "crawl")
      .map((o) => [wu(room.worldX + o.x - 50), wu(room.worldX + o.x + o.w + 50)] as const);
    const count = Math.max(3, Math.round(w / 2.2));
    for (let i = 1; i < count; i++) {
      const x = x0 + (i / count) * w;
      if (crawlSpans.some(([a, b]) => x >= a && x <= b)) continue;
      const beam = box(0.18, 0.16, FLOOR_DEPTH + 0.1, this.mats.wood, x, CEIL_Y, FLOOR_Z);
      beam.castShadow = true;
      this.group.add(beam);
    }
    const ceiling = box(w + 0.1, 0.1, FLOOR_DEPTH + 0.2, this.mats.woodDeep, x0 + w / 2, CEIL_Y + 0.12, FLOOR_Z);
    ceiling.receiveShadow = true;
    this.group.add(ceiling);
  }

  private wainscot(x0: number, w: number): void {
    const panel = box(w + 0.06, 1.15, 0.08, this.mats.wood, x0 + w / 2, 0.58, WALL_Z + 0.1);
    panel.receiveShadow = true;
    this.group.add(panel);
    this.group.add(box(w + 0.06, 0.07, 0.1, this.mats.woodLit, x0 + w / 2, 1.16, WALL_Z + 0.14));
  }

  private baseboard(x0: number, w: number): void {
    this.group.add(box(w + 0.06, 0.1, 0.08, this.mats.woodDeep, x0 + w / 2, 0.05, WALL_Z + 0.16));
  }

  private partition(room: BakedRoom, x0: number): void {
    if (room.index === 0) {
      // Entry wall with a door opening behind the start.
      const wall = box(0.22, WALL_H, FLOOR_DEPTH + 0.2, this.mats.plaster, x0 - 0.1, WALL_H / 2, FLOOR_Z);
      this.group.add(wall);
      const frame = this.doorFrame(x0 + 0.15, 1.15);
      this.group.add(frame);
      return;
    }
    // Doorway between rooms, solid around a passage.
    const passW = 1.2;
    const passH = 2.35;
    const zParts = [
      [FLOOR_Z0, -0.55],
      [0.55, FLOOR_Z1],
    ];
    for (const [za, zb] of zParts) {
      const d = zb - za;
      const p = box(0.22, WALL_H, d, this.mats.wood, x0, WALL_H / 2, (za + zb) / 2);
      p.castShadow = true;
      this.group.add(p);
    }
    const lintel = box(0.24, WALL_H - passH, passW, this.mats.wood, x0, passH + (WALL_H - passH) / 2, 0);
    this.group.add(lintel);
    void passH;
  }

  private doorFrame(x: number, openW: number): THREE.Group {
    const g = new THREE.Group();
    const h = 2.4;
    g.add(box(0.12, h, 0.12, this.mats.wood, x, h / 2, -openW / 2));
    g.add(box(0.12, h, 0.12, this.mats.wood, x, h / 2, openW / 2));
    g.add(box(0.12, 0.12, openW + 0.12, this.mats.wood, x, h, 0));
    return g;
  }

  private dressing(room: BakedRoom, x0: number, w: number, mid: number): void {
    // Set dressing stays off the walk line (z near the back wall).
    const back = -1.55;
    switch (room.kind) {
      case "longHall":
        // Calm start. Window and a back-wall table, nothing on the vault's walk line.
        this.sideTable(x0 + wu(90), back);
        this.pictureRail(x0 + wu(900));
        // Gap beat: the only chest here is set dressing, against the back wall, off the walk line.
        this.chest(x0 + wu(1360), -1.72, 0.58, 0.42, 0.4, true);
        this.pictureRail(x0 + wu(2000));
        // After the door, a quiet stretch into the exit. Still off the walk line.
        this.sideTable(x0 + wu(3780), back);
        break;
      case "foyer":
        this.sideTable(x0 + 1.6, back);
        this.pictureRail(mid + 1.2);
        break;
      case "hall":
        this.pictureRail(mid);
        this.sideTable(x0 + w - 1.8, back);
        break;
      case "frontDoor":
        this.frontDoorProp(x0 + wu(300), 0);
        // Board 05 chest is set dressing — off the walk line, back corner.
        this.chest(x0 + w - 1.4, back - 0.1, 0.7, 0.55, 0.5, true);
        break;
      case "fan":
        this.sideTable(x0 + 1.5, back);
        break;
      case "curtains":
        break;
      case "kitchen":
        this.shelves(mid - 1.6, back);
        this.sideTable(x0 + w - 1.8, back);
        break;
      case "leaky":
        this.ceilingWound(x0 + wu(460) + wu(62), 2.2);
        this.chest(x0 + w - 1.3, back, 0.7, 0.5, 0.48, true);
        break;
      case "cross":
        this.pictureRail(mid - 2);
        this.sideTable(x0 + 1.4, back);
        break;
      case "attic":
        this.trunk(x0 + 1.3, back);
        break;
      case "stairwell":
        this.stairSuggestion(x0 + wu(400), back - 0.1);
        this.chest(x0 + w - 1.5, back, 0.66, 0.5, 0.46, true);
        break;
      case "storm":
        this.sideTable(x0 + 1.6, back);
        break;
      case "landing":
        this.sideTable(mid, back);
        this.pictureRail(mid + 2);
        break;
    }
  }

  private obstacles(room: BakedRoom): void {
    for (const obs of room.obstacles ?? []) {
      if (obs.kind === "vault") this.vaultPiece(room, obs);
      else if (obs.kind === "crawl") this.crawlPiece(room, obs);
      else if (obs.kind === "closingDoor") this.closingDoor(room, obs);
    }
  }

  private vaultPiece(room: BakedRoom, obs: Extract<Obstacle, { kind: "vault" }>): void {
    const x = wu(room.worldX + obs.x + obs.w / 2);
    const w = wu(obs.w);
    const h = wu(obs.h);
    const z = 0;
    if (room.kind === "fan") this.sofa(x, z, w, h);
    else if (room.kind === "storm") this.cabinet(x, z, w, h);
    else this.chest(x, z, w, h, 0.7, false);
  }

  private chest(x: number, z: number, w: number, h: number, d: number, dressing: boolean): void {
    const body = box(w, h * 0.82, d, this.mats.wood, x, h * 0.41, z);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);
    const lid = box(w + 0.04, 0.08, d + 0.04, this.mats.woodLit, x, h - 0.02, z);
    lid.castShadow = true;
    this.group.add(lid);
    const corners: Array<[number, number, number]> = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([sx, sz]) => [x + sx * (w / 2 - 0.04), 0.04, z + sz * (d / 2 - 0.04)]);
    for (const [cx, cy, cz] of corners) {
      const cap = box(0.08, h * 0.85, 0.08, this.mats.copper, cx, cy + h * 0.4, cz);
      cap.castShadow = true;
      this.group.add(cap);
    }
    const latch = box(0.08, 0.06, 0.04, this.mats.copper, x, h * 0.55, z + d / 2);
    this.group.add(latch);
    void dressing;
  }

  private sofa(x: number, z: number, w: number, h: number): void {
    const d = 0.78;
    const seat = box(w, h * 0.55, d, this.mats.curtain, x, h * 0.28, z);
    seat.castShadow = true;
    seat.receiveShadow = true;
    this.group.add(seat);
    const back = box(w, h * 0.7, 0.16, this.mats.curtainShadow, x, h * 0.55, z - d / 2 + 0.08);
    back.castShadow = true;
    this.group.add(back);
    this.group.add(box(0.12, h * 0.7, d, this.mats.wood, x - w / 2 + 0.06, h * 0.35, z));
    this.group.add(box(0.12, h * 0.7, d, this.mats.wood, x + w / 2 - 0.06, h * 0.35, z));
    // Legs
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.group.add(box(0.08, 0.12, 0.08, this.mats.woodDeep, x + sx * (w / 2 - 0.12), 0.06, z + sz * (d / 2 - 0.12)));
      }
    }
  }

  private cabinet(x: number, z: number, w: number, h: number): void {
    const d = 0.62;
    const body = box(w, h, d, this.mats.wood, x, h / 2, z);
    body.castShadow = true;
    body.receiveShadow = true;
    body.rotation.z = -0.08;
    this.group.add(body);
    this.group.add(box(w * 0.42, h * 0.7, 0.04, this.mats.woodMid, x - w * 0.18, h * 0.5, z + d / 2 + 0.01));
    this.group.add(box(w * 0.42, h * 0.7, 0.04, this.mats.woodMid, x + w * 0.18, h * 0.5, z + d / 2 + 0.01));
    this.group.add(box(0.05, 0.05, 0.05, this.mats.copper, x - w * 0.05, h * 0.5, z + d / 2 + 0.04));
    this.group.add(box(0.05, 0.05, 0.05, this.mats.copper, x + w * 0.05, h * 0.5, z + d / 2 + 0.04));
  }

  private crawlPiece(room: BakedRoom, obs: Extract<Obstacle, { kind: "crawl" }>): void {
    // Soffit / bulkhead dropped from the ceiling. The mouth is an empty rectangle:
    // vertical boarding, a heavy lintel, floorboards running through. No legs, seat, or window.
    const left = wu(room.worldX + obs.x);
    const width = wu(obs.w);
    const mid = left + width / 2;
    const mouthTop = wu(obs.clearance);
    const lintelH = 0.4;
    const soffitTop = CEIL_Y + 0.02;
    const jambW = 0.28;
    // Shallow in Z so the side camera reads a rectangle, not a long wedge.
    const z0 = -0.22;
    const z1 = 0.78;
    const zMid = (z0 + z1) / 2;
    const zDepth = z1 - z0;
    const mouthL = left + jambW;
    const mouthR = left + width - jambW;
    const mouthW = mouthR - mouthL;
    const mouthMid = (mouthL + mouthR) / 2;

    const upperH = soffitTop - (mouthTop + lintelH);
    const upper = box(width + 0.2, upperH, zDepth, this.mats.wood, mid, mouthTop + lintelH + upperH / 2, zMid);
    upper.castShadow = true;
    upper.receiveShadow = true;
    this.group.add(upper);

    const plankW = 0.18;
    const faceZ = z1 + 0.025;
    for (let x = left + 0.08; x < left + width - 0.08; x += plankW + 0.03) {
      const plank = box(
        plankW,
        upperH - 0.06,
        0.04,
        this.mats.woodMid,
        x + plankW / 2,
        mouthTop + lintelH + upperH / 2,
        faceZ,
      );
      plank.castShadow = true;
      this.group.add(plank);
    }

    const lintel = box(width + 0.28, lintelH, zDepth + 0.1, this.mats.woodDeep, mid, mouthTop + lintelH / 2, zMid + 0.02);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    this.group.add(lintel);
    const lip = box(mouthW + 0.04, 0.05, zDepth + 0.14, this.mats.woodLit, mouthMid, mouthTop + 0.015, zMid + 0.02);
    lip.castShadow = true;
    this.group.add(lip);

    for (const side of [-1, 1] as const) {
      const jx = side < 0 ? left + jambW / 2 : left + width - jambW / 2;
      const jamb = box(jambW, mouthTop + lintelH, zDepth, this.mats.wood, jx, (mouthTop + lintelH) / 2, zMid);
      jamb.castShadow = true;
      jamb.receiveShadow = true;
      this.group.add(jamb);
      const revealX = side < 0 ? mouthL + 0.03 : mouthR - 0.03;
      const reveal = box(0.05, Math.max(0.2, mouthTop - 0.06), zDepth * 0.9, this.mats.woodDeep, revealX, mouthTop / 2, zMid);
      reveal.castShadow = true;
      this.group.add(reveal);
    }

    // Dark back of the hole, held above the floor so the boards stay visible.
    const voidH = Math.max(0.2, mouthTop - 0.18);
    const recess = box(mouthW - 0.1, voidH, 0.1, this.mats.voidMat, mouthMid, 0.16 + voidH / 2, z0 + 0.16);
    this.group.add(recess);

    const runner = box(mouthW - 0.06, 0.04, zDepth * 0.62, this.mats.floor, mouthMid, 0.02, 0.05);
    runner.receiveShadow = true;
    this.group.add(runner);
    const seams = Math.max(3, Math.round(mouthW / 0.36));
    for (let i = 1; i < seams; i++) {
      const bx = mouthL + (mouthW * i) / seams;
      this.group.add(box(0.02, 0.045, zDepth * 0.58, this.mats.woodDeep, bx, 0.03, 0.05));
    }
  }

  private closingDoor(room: BakedRoom, obs: Extract<Obstacle, { kind: "closingDoor" }>): void {
    const x = wu(room.worldX + obs.x);
    const openW = wu(obs.openW);
    const h = 2.35;
    // Chunkier frame so the passage reads from the side, not as a hairline.
    this.group.add(box(0.28, h + 0.16, 0.22, this.mats.wood, x, h / 2, -openW / 2 - 0.04));
    this.group.add(box(0.28, h + 0.16, 0.22, this.mats.wood, x, h / 2, openW / 2 + 0.04));
    this.group.add(box(0.32, 0.2, openW + 0.5, this.mats.woodLit, x, h + 0.08, 0));
    this.group.add(box(0.34, 0.08, openW + 0.36, this.mats.woodDeep, x, 0.04, 0));
    // Hinge on the back-wall side; door swings across the walk line toward +z / closed.
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, -openW / 2);
    const door = new THREE.Group();
    door.position.set(0, 0, openW / 2);
    const leaf = box(0.22, h, openW, this.mats.wood, 0, h / 2, 0);
    leaf.castShadow = true;
    door.add(leaf);
    // Panels
    door.add(box(0.04, h * 0.38, openW * 0.36, this.mats.woodMid, 0.06, h * 0.32, -openW * 0.18));
    door.add(box(0.04, h * 0.38, openW * 0.36, this.mats.woodMid, 0.06, h * 0.32, openW * 0.18));
    door.add(box(0.04, h * 0.32, openW * 0.36, this.mats.woodMid, 0.06, h * 0.72, -openW * 0.18));
    door.add(box(0.04, h * 0.32, openW * 0.36, this.mats.woodMid, 0.06, h * 0.72, openW * 0.18));
    door.add(box(0.05, 0.05, 0.05, this.mats.copper, 0.14, h * 0.52, openW * 0.32));
    // Leading edge catches the candle as the opening shrinks.
    door.add(box(0.26, h * 0.92, 0.045, this.mats.woodLit, 0.02, h / 2, openW / 2 - 0.02));
    pivot.add(door);
    this.group.add(pivot);
    const key = `${room.index}:door`;
    this.doors.push({ key, pivot, roomIndex: room.index, obs });
    // Start fully open.
    pivot.rotation.y = -Math.PI * 0.5;
  }

  private hazards(room: BakedRoom, x0: number, w: number, mid: number): void {
    for (const h of room.hazards) {
      if (h.kind === "fan") {
        const fx = x0 + wu(h.x);
        const mount = new THREE.Group();
        mount.position.set(fx, 2.15, WALL_Z + 0.35);
        const hub = box(0.16, 0.16, 0.16, this.mats.metal, 0, 0, 0.1);
        const blades = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const blade = box(1.15, 0.06, 0.16, this.mats.metalLit, 0.4, 0, 0);
          blade.rotation.z = (i / 3) * Math.PI * 2;
          blades.add(blade);
        }
        mount.add(hub, blades);
        this.group.add(mount);
        this.fans.push({ blades, period: h.period, sweep: h.sweep });
      }
      if (h.kind === "periodic" || room.kind === "curtains") {
        // curtains placed once per room below
      }
    }
    if (room.kind === "longHall") {
      // Still curtains on the opening window so the title reads as a furnished hall.
      this.curtainAt(x0 + wu(240) - 0.55, 0.03);
      this.curtainAt(x0 + wu(240) + 0.62, 0.03);
      for (const h of room.hazards) {
        if (h.kind !== "draft") continue;
        // Curtains live inside the draft only, flanking windows, never on a later obstacle.
        for (let i = 0; i < 3; i++) {
          const local = h.x + (h.w * (i + 0.5)) / 3;
          this.curtainAt(x0 + wu(local) - 0.35, 0.2);
          this.curtainAt(x0 + wu(local) + 0.45, 0.16);
        }
      }
    }
    if (room.kind === "curtains" || room.kind === "storm" || room.kind === "hall") {
      const spots = room.kind === "curtains" ? [0.22, 0.5, 0.78] : [0.3, 0.7];
      for (const t of spots) this.curtainAt(x0 + w * t);
    }
    if (room.kind === "attic") {
      // Ceiling vent grille over the crawl mouth.
      const vx = mid;
      this.group.add(box(1.4, 0.08, 0.8, this.mats.metal, vx, CEIL_Y - 0.08, -0.4));
      for (let i = 0; i < 5; i++) {
        this.group.add(box(1.2, 0.02, 0.04, this.mats.metalLit, vx, CEIL_Y - 0.14, -0.7 + i * 0.14));
      }
    }
    void mid;
  }

  private curtainAt(x: number, sway = 0.05): void {
    const cloth = box(0.55, 2.4, 0.12, this.mats.curtain, 0, 1.2, 0);
    cloth.castShadow = true;
    const fold = box(0.18, 2.35, 0.16, this.mats.curtainShadow, 0.16, 1.18, 0.02);
    const rod = box(0.8, 0.05, 0.05, this.mats.copper, 0, 2.42, 0);
    const g = new THREE.Group();
    g.position.set(x, 0.0, WALL_Z + 0.28);
    g.userData.sway = sway;
    g.add(cloth, fold, rod);
    this.group.add(g);
    this.curtains.push(g);
  }

  private sideTable(x: number, z: number): void {
    const top = box(0.7, 0.08, 0.42, this.mats.woodLit, x, 0.62, z);
    top.castShadow = true;
    this.group.add(top);
    this.group.add(box(0.08, 0.62, 0.08, this.mats.wood, x - 0.26, 0.31, z - 0.14));
    this.group.add(box(0.08, 0.62, 0.08, this.mats.wood, x + 0.26, 0.31, z - 0.14));
    this.group.add(box(0.08, 0.62, 0.08, this.mats.wood, x - 0.26, 0.31, z + 0.14));
    this.group.add(box(0.08, 0.62, 0.08, this.mats.wood, x + 0.26, 0.31, z + 0.14));
  }

  private shelves(x: number, z: number): void {
    for (let i = 0; i < 3; i++) {
      this.group.add(box(1.2, 0.06, 0.28, this.mats.wood, x, 1.15 + i * 0.38, z));
    }
    this.group.add(box(0.08, 1.3, 0.28, this.mats.woodDeep, x - 0.58, 1.55, z));
    this.group.add(box(0.08, 1.3, 0.28, this.mats.woodDeep, x + 0.58, 1.55, z));
  }

  private pictureRail(x: number): void {
    this.group.add(box(0.9, 0.08, 0.06, this.mats.wood, x, 2.35, WALL_Z + 0.14));
    this.group.add(box(0.55, 0.4, 0.04, this.mats.woodDeep, x, 2.05, WALL_Z + 0.16));
  }

  private trunk(x: number, z: number): void {
    this.chest(x, z, 0.7, 0.42, 0.48, true);
  }

  private stairSuggestion(x: number, z: number): void {
    for (let i = 0; i < 6; i++) {
      const step = box(1.4, 0.1, 0.32, this.mats.wood, x, 0.08 + i * 0.18, z - i * 0.12);
      step.castShadow = true;
      this.group.add(step);
    }
    this.group.add(box(0.08, 1.3, 0.08, this.mats.woodLit, x - 0.65, 0.7, z - 0.2));
  }

  private ceilingWound(x: number, zSpread: number): void {
    this.group.add(box(1.1, 0.12, 0.8, this.mats.voidMat, x, CEIL_Y - 0.02, -0.3));
    this.group.add(box(1.3, 0.05, 1.0, this.mats.woodDeep, x, CEIL_Y - 0.1, -0.3));
    void zSpread;
  }

  private frontDoorProp(x: number, _unused: number): void {
    // Open exterior door in the back wall — gust source, not a walk-line gate.
    const h = 2.5;
    const w = 1.05;
    this.group.add(box(w + 0.2, 0.12, 0.12, this.mats.wood, x, h + 0.06, WALL_Z + 0.16));
    this.group.add(box(0.12, h, 0.12, this.mats.wood, x - w / 2, h / 2, WALL_Z + 0.16));
    this.group.add(box(0.12, h, 0.12, this.mats.wood, x + w / 2, h / 2, WALL_Z + 0.16));
    const night = box(w, h, 0.04, this.mats.night, x, h / 2, WALL_Z + 0.08);
    this.group.add(night);
    const leaf = box(0.1, h, w, this.mats.wood, x + w / 2 + 0.04, h / 2, WALL_Z + 0.55);
    leaf.rotation.y = 0.15;
    leaf.castShadow = true;
    this.group.add(leaf);
    this.windows.push({ x, y: 1.4, z: WALL_Z + 0.3 });
  }

  /** Glowing doorway at the end of the hall. Not a gate — reaching it with the flame lit wins. */
  private endCap(x: number): void {
    const openW = 1.45;
    const openH = 2.5;
    const side = (FLOOR_DEPTH - openW) / 2;
    const leftWall = box(0.24, WALL_H, side, this.mats.plaster, x, WALL_H / 2, FLOOR_Z0 + side / 2);
    const rightWall = box(0.24, WALL_H, side, this.mats.plaster, x, WALL_H / 2, FLOOR_Z1 - side / 2);
    leftWall.receiveShadow = true;
    rightWall.receiveShadow = true;
    this.group.add(leftWall, rightWall);
    const lintel = box(0.26, WALL_H - openH, openW + 0.12, this.mats.wood, x, openH + (WALL_H - openH) / 2, 0);
    lintel.castShadow = true;
    this.group.add(lintel);
    this.group.add(box(0.22, openH, 0.2, this.mats.woodLit, x - 0.02, openH / 2, -openW / 2));
    this.group.add(box(0.22, openH, 0.2, this.mats.woodLit, x - 0.02, openH / 2, openW / 2));
    // Tilt the glow toward the side camera so the doorway reads as a lit opening, not a hairline.
    const glow = box(0.08, openH - 0.28, openW - 0.28, this.mats.exitGlow, x + 0.05, openH / 2, 0);
    glow.rotation.y = -0.7;
    this.group.add(glow);
  }
}

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.02, w), Math.max(0.02, h), Math.max(0.02, d)), mat);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

function buildMaterials(textures: GameTextures) {
  return {
    wood: makeMaterial(C.wood, textures, "wood", { repeat: [1.2, 1] }),
    woodMid: makeMaterial(C.woodMid, textures, "wood", { repeat: [0.8, 0.8] }),
    woodLit: makeMaterial(C.woodLit, textures, "wood", { roughness: 0.72, repeat: [1, 1] }),
    woodDeep: makeMaterial(C.woodDeep, textures, "wood", { roughness: 0.84, repeat: [1, 1] }),
    floor: makeMaterial(C.floor, textures, "floor", { repeat: [2.4, 1.2] }),
    floorLit: makeMaterial(C.floorLit, textures, "floor", { roughness: 0.74, repeat: [1.2, 0.8] }),
    plaster: makeMaterial(C.plaster, textures, "plaster", { repeat: [2.2, 1.4] }),
    curtain: makeMaterial(C.curtain, textures, "curtain", { repeat: [1, 2] }),
    curtainShadow: makeMaterial(C.curtainShadow, textures, "curtain", { repeat: [1, 2] }),
    copper: makeMaterial(C.copper, textures, "copper"),
    metal: makeMaterial(C.metal, textures, "metal"),
    metalLit: makeMaterial(C.metalLit, textures, "metal", { roughness: 0.45, metalness: 0.68 }),
    night: new THREE.MeshStandardMaterial({
      color: C.nightDeep,
      roughness: 1,
      metalness: 0,
      emissive: C.nightMid,
      emissiveIntensity: 0.15,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x1a2838,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.35,
    }),
    voidMat: new THREE.MeshStandardMaterial({
      color: C.floorVoid,
      roughness: 1,
      metalness: 0,
    }),
    exitGlow: new THREE.MeshStandardMaterial({
      color: 0x6a3a22,
      emissive: C.flameBounce,
      emissiveIntensity: 0.65,
      roughness: 0.72,
      metalness: 0.02,
    }),
  };
}

function windowPlan(room: BakedRoom): Array<{ localX: number; w: number; h: number; sill: number }> {
  const tall = { w: 1.15, h: 1.55, sill: 1.25 };
  const wide = { w: 1.6, h: 1.25, sill: 1.35 };
  switch (room.kind) {
    case "longHall":
      // Windows mark calm and the draft. None sit on the vault, gap, crawl mouth, or door.
      return [
        { localX: 240, ...tall },
        { localX: 900, ...tall },
        { localX: 1620, ...tall },
        { localX: 1910, ...wide },
        { localX: 2200, ...tall },
        { localX: 3820, ...tall },
      ];
    case "foyer":
      return [{ localX: 700, ...tall }];
    case "hall":
      return [{ localX: 240, ...tall }, { localX: 820, ...tall }];
    case "frontDoor":
      return [{ localX: 160, w: 0.7, h: 1.8, sill: 0.5 }, { localX: 440, w: 0.7, h: 1.8, sill: 0.5 }];
    case "fan":
      return [{ localX: 860, ...wide }];
    case "curtains":
      return [{ localX: 260, ...tall }, { localX: 590, ...tall }, { localX: 920, ...tall }];
    case "kitchen":
      return [{ localX: 300, ...wide }];
    case "leaky":
      return [{ localX: 200, ...tall }, { localX: 900, ...tall }];
    case "cross":
      return [{ localX: 220, ...tall }, { localX: 940, ...tall }];
    case "attic":
      return [{ localX: 200, w: 0.9, h: 0.8, sill: 2.0 }];
    case "stairwell":
      return [{ localX: 260, ...tall }, { localX: 1180, ...tall }];
    case "storm":
      return [{ localX: 400, w: 2.1, h: 1.7, sill: 1.15 }];
    case "landing":
      return [{ localX: 500, ...tall }];
  }
}
