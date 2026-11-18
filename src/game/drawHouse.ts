import Phaser from "phaser";
import { C, CEILING_Y, FLOOR_Y, GAME_H, WAINSCOT_Y } from "./constants";
import type { BakedRoom, Obstacle, RoomKind } from "./rooms";

type G = Phaser.GameObjects.Graphics;

function wallTone(kind: RoomKind): { top: number; mid: number; lower: number } {
  switch (kind) {
    case "foyer":
      return { top: 0x1c1410, mid: 0x241a14, lower: 0x2a1c14 };
    case "hall":
      return { top: 0x161210, mid: 0x1c1614, lower: 0x241a16 };
    case "frontDoor":
      return { top: 0x16120f, mid: 0x1e1612, lower: 0x261c16 };
    case "fan":
      return { top: 0x181210, mid: 0x221814, lower: 0x2a1e16 };
    case "curtains":
      return { top: 0x161014, mid: 0x1c1418, lower: 0x24181c };
    case "kitchen":
      return { top: 0x1c1410, mid: 0x261a12, lower: 0x2e2014 };
    case "leaky":
      return { top: 0x141210, mid: 0x1a1612, lower: 0x201a14 };
    case "cross":
      return { top: 0x161318, mid: 0x1c171c, lower: 0x241c20 };
    case "attic":
      return { top: 0x100e0c, mid: 0x161210, lower: 0x1c1612 };
    case "stairwell":
      return { top: 0x12100e, mid: 0x1a1410, lower: 0x221a14 };
    case "storm":
      return { top: 0x12141a, mid: 0x18161c, lower: 0x201c1c };
    case "landing":
      return { top: 0x1a1410, mid: 0x221a14, lower: 0x2a2018 };
    default:
      return { top: C.bgTop, mid: C.bgMid, lower: C.bgWarm };
  }
}

export function drawWindow(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  nightTop: number = C.night,
  nightBot: number = C.nightLite,
): void {
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x - 8, y - 8, w + 16, h + 16);
  g.fillStyle(C.trim, 1);
  g.fillRect(x - 5, y - 5, w + 10, h + 10);
  g.fillGradientStyle(nightTop, nightTop, nightBot, nightBot, 1, 1, 1, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(C.moon, 0.1);
  g.fillCircle(x + w * 0.68, y + h * 0.28, Math.min(w, h) * 0.22);
  g.fillStyle(C.trimLite, 0.85);
  g.fillRect(x + w * 0.5 - 3, y, 6, h);
  g.fillRect(x, y + h * 0.5 - 3, w, 6);
  g.fillStyle(0xd8c8a0, 0.06);
  g.fillRect(x + 6, y + 6, w * 0.28, h * 0.2);
}

function drawFloor(g: G, x: number, width: number): void {
  g.fillGradientStyle(C.floorLite, C.floorLite, C.floor, C.floor, 1, 1, 1, 1);
  g.fillRect(x, FLOOR_Y, width, GAME_H - FLOOR_Y);
  g.fillStyle(C.woodDeep, 1);
  g.fillRect(x, FLOOR_Y, width, 8);
  g.lineStyle(1, 0x000000, 0.22);
  const boards = Math.max(4, Math.floor(width / 58));
  for (let i = 1; i < boards; i++) {
    const bx = x + (width * i) / boards;
    g.lineBetween(bx, FLOOR_Y + 8, bx, GAME_H);
  }
  g.lineStyle(1, C.woodMid, 0.18);
  for (let i = 0; i < 5; i++) {
    const y = FLOOR_Y + 18 + i * 28;
    g.lineBetween(x, y, x + width, y);
  }
}

function drawPanels(g: G, room: BakedRoom): void {
  const { worldX: x, width } = room;
  g.lineStyle(2, 0x000000, 0.18);
  const cols = Math.max(3, Math.round(width / 220));
  for (let i = 0; i < cols; i++) {
    const px = x + 24 + (i * (width - 48)) / cols;
    const pw = (width - 48) / cols - 16;
    g.strokeRect(px, CEILING_Y + 36, pw, WAINSCOT_Y - CEILING_Y - 52);
  }
}

function drawShell(g: G, room: BakedRoom): void {
  const { worldX: x, width, kind } = room;
  const tone = wallTone(kind);
  g.fillGradientStyle(tone.top, tone.top, tone.mid, tone.mid, 1, 1, 1, 1);
  g.fillRect(x, 0, width, WAINSCOT_Y);
  g.fillGradientStyle(tone.mid, tone.mid, tone.lower, tone.lower, 1, 1, 1, 1);
  g.fillRect(x, WAINSCOT_Y, width, FLOOR_Y - WAINSCOT_Y);
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x, WAINSCOT_Y - 8, width, 12);
  g.fillStyle(C.woodMid, 1);
  g.fillRect(x, WAINSCOT_Y, width, 6);
  g.fillStyle(C.woodDeep, 1);
  g.fillRect(x, 0, width, CEILING_Y);
  g.fillGradientStyle(0x0c0a08, 0x0c0a08, tone.top, tone.top, 1, 1, 1, 1);
  g.fillRect(x, 0, width, CEILING_Y);
  g.fillStyle(C.woodMid, 1);
  g.fillRect(x, CEILING_Y, width, 8);
  // ceiling beams
  g.fillStyle(C.woodDeep, 0.9);
  const beams = Math.max(2, Math.round(width / 280));
  for (let i = 0; i <= beams; i++) {
    const bx = x + (width * i) / beams - 8;
    g.fillRect(bx, 10, 16, CEILING_Y + 10);
  }
  drawFloor(g, x, width);
  drawPanels(g, room);
}

function drawRug(g: G, x: number, y: number, w: number, h: number, color: number): void {
  g.fillStyle(color, 0.7);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(2, 0x000000, 0.2);
  g.strokeRoundedRect(x + 6, y + 4, w - 12, h - 8, 6);
}

function drawTable(g: G, x: number, y: number, w: number, h: number, d = 16): void {
  g.fillStyle(C.wood, 1);
  g.fillRect(x, y, w, d);
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x + 8, y + d, 8, h - d);
  g.fillRect(x + w - 16, y + d, 8, h - d);
}

function drawDoorway(g: G, room: BakedRoom, isExit: boolean): void {
  const x = room.worldX + room.width;
  const frameW = isExit ? 118 : 108;
  const frameX = x - frameW * 0.5;
  const top = 200;
  g.fillStyle(isExit ? 0x3a2410 : 0x0a0806, 1);
  if (isExit) {
    g.fillGradientStyle(0x5a3a18, 0x5a3a18, 0xe8b060, 0xc48a3a, 1, 1, 1, 1);
  } else {
    g.fillStyle(0x0c0a08, 1);
  }
  g.fillRect(frameX + 8, top, frameW - 16, FLOOR_Y - top);
  g.fillStyle(C.wood, 1);
  g.fillRect(frameX, top - 18, frameW, 22);
  g.fillRect(frameX, top, 14, FLOOR_Y - top);
  g.fillRect(frameX + frameW - 14, top, 14, FLOOR_Y - top);
  if (isExit) {
    g.fillStyle(C.flame, 0.18);
    g.fillRect(frameX + 14, top + 8, frameW - 28, FLOOR_Y - top - 8);
    g.fillStyle(C.flameMid, 0.12);
    g.fillCircle(x, FLOOR_Y - 160, 70);
  }
}

function furnitureFoyer(g: G, r: BakedRoom): void {
  const x = r.worldX;
  drawWindow(g, x + 560, 168, 190, 250);
  // curtain rod + static drape tails (billow is dynamic)
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x + 548, 154, 214, 8);
  drawRug(g, x + 260, FLOOR_Y - 14, 420, 70, 0x3a2420);
  drawTable(g, x + 300, FLOOR_Y - 86, 200, 86, 18);
  g.fillStyle(0x4a3020, 1);
  g.fillEllipse(x + 400, FLOOR_Y - 96, 36, 16);
  // coat rack
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x + 150, FLOOR_Y - 250, 8, 250);
  g.fillRect(x + 128, FLOOR_Y - 248, 52, 8);
  g.fillStyle(0x2a1c28, 1);
  g.fillRoundedRect(x + 118, FLOOR_Y - 230, 34, 110, 8);
  g.fillStyle(0x1e2420, 1);
  g.fillRoundedRect(x + 156, FLOOR_Y - 210, 30, 90, 8);
  // picture
  g.fillStyle(C.trim, 1);
  g.fillRect(x + 240, 200, 70, 86);
  g.fillStyle(0x2a2018, 1);
  g.fillRect(x + 248, 208, 54, 70);
}

function furnitureHall(g: G, r: BakedRoom): void {
  const x = r.worldX;
  drawRug(g, x + 80, FLOOR_Y - 10, r.width - 160, 44, 0x3a1c1c);
  const windows = [180, 500, 820];
  for (const wx of windows) {
    drawWindow(g, x + wx, 170, 150, 230);
    g.fillStyle(C.woodDark, 1);
    g.fillRect(x + wx - 10, 158, 170, 7);
  }
  // unlit sconces
  for (const sx of [360, 680]) {
    g.fillStyle(C.metal, 1);
    g.fillRect(x + sx, 260, 8, 28);
    g.fillCircle(x + sx + 4, 254, 10);
  }
}

function furnitureFrontDoor(g: G, r: BakedRoom): void {
  const x = r.worldX;
  // Door opening in the back wall — the swinging door itself is dynamic.
  const dx = x + 430;
  g.fillStyle(C.woodDark, 1);
  g.fillRect(dx - 16, 168, 172, FLOOR_Y - 168);
  g.fillStyle(C.night, 1);
  g.fillRect(dx, 186, 140, FLOOR_Y - 194);
  g.fillGradientStyle(C.night, C.night, C.nightLite, C.nightLite, 1, 1, 1, 1);
  g.fillRect(dx, 186, 140, FLOOR_Y - 194);
  g.fillStyle(C.wood, 1);
  g.fillRect(dx - 14, 168, 168, 16);
  g.fillRect(dx - 14, 186, 14, FLOOR_Y - 194);
  g.fillRect(dx + 140, 186, 14, FLOOR_Y - 194);
  drawRug(g, x + 80, FLOOR_Y - 12, 280, 50, 0x2a1a14);
  drawTable(g, x + 140, FLOOR_Y - 80, 150, 80);
  // bench
  g.fillStyle(C.woodMid, 1);
  g.fillRect(x + 720, FLOOR_Y - 58, 160, 14);
  g.fillRect(x + 728, FLOOR_Y - 44, 8, 44);
  g.fillRect(x + 864, FLOOR_Y - 44, 8, 44);
}

function furnitureFan(g: G, r: BakedRoom): void {
  const x = r.worldX;
  drawWindow(g, x + 80, 180, 140, 210);
  // wall sofa (decorative, off the walking line)
  g.fillStyle(0x3a2a28, 1);
  g.fillRoundedRect(x + 120, FLOOR_Y - 90, 180, 90, 12);
  g.fillStyle(0x2e2220, 1);
  g.fillRoundedRect(x + 130, FLOOR_Y - 124, 70, 46, 10);
  g.fillRoundedRect(x + 220, FLOOR_Y - 124, 70, 46, 10);
  // side table
  drawTable(g, x + 820, FLOOR_Y - 70, 90, 70, 12);
  g.fillStyle(0x4a4030, 1);
  g.fillRect(x + 848, FLOOR_Y - 118, 14, 48);
  g.fillStyle(0x2a2010, 1);
  g.fillEllipse(x + 855, FLOOR_Y - 122, 36, 14);
  // fan pedestal (blades / cone are dynamic)
  const fx = x + 560;
  g.fillStyle(C.metal, 1);
  g.fillRect(fx - 6, FLOOR_Y - 70, 12, 70);
  g.fillStyle(C.metalLite, 1);
  g.fillEllipse(fx, FLOOR_Y - 6, 48, 12);
  g.fillCircle(fx, FLOOR_Y - 78, 14);
}

function furnitureCurtains(g: G, r: BakedRoom): void {
  const x = r.worldX;
  const windows = [160, 500, 840];
  for (const wx of windows) {
    drawWindow(g, x + wx, 150, 200, 270, 0x14101c, 0x201828);
    g.fillStyle(C.woodDark, 1);
    g.fillRect(x + wx - 16, 136, 232, 8);
  }
  drawRug(g, x + 60, FLOOR_Y - 10, r.width - 120, 36, 0x2a181c);
}

function furnitureKitchen(g: G, r: BakedRoom): void {
  const x = r.worldX;
  // counters
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x + 40, FLOOR_Y - 118, 280, 118);
  g.fillStyle(C.wood, 1);
  g.fillRect(x + 36, FLOOR_Y - 128, 288, 16);
  g.fillStyle(C.metal, 1);
  g.fillRect(x + 80, FLOOR_Y - 200, 90, 72);
  g.fillStyle(C.metalLite, 1);
  g.fillRect(x + 88, FLOOR_Y - 208, 74, 10);
  // cabinets
  g.fillStyle(C.woodMid, 1);
  g.fillRect(x + 40, 160, 280, 70);
  g.lineStyle(2, C.woodDeep, 0.6);
  g.strokeRect(x + 48, 168, 126, 54);
  g.strokeRect(x + 186, 168, 126, 54);
  // hanging pans
  for (const px of [70, 120, 170]) {
    g.lineStyle(1, C.metalLite, 0.8);
    g.lineBetween(x + px, 230, x + px, 250);
    g.fillStyle(C.metal, 1);
    g.fillEllipse(x + px, 262, 22, 16);
  }
  drawTable(g, x + 640, FLOOR_Y - 92, 220, 92, 18);
  g.fillStyle(0x3a2a20, 1);
  g.fillRect(x + 700, FLOOR_Y - 108, 44, 18);
  g.fillStyle(0x2a3030, 1);
  g.fillCircle(x + 800, FLOOR_Y - 102, 14);
  // Mid-room closing door frame is drawn via obstacles (closingDoor).
}

function furnitureLeaky(g: G, r: BakedRoom): void {
  const x = r.worldX;
  drawWindow(g, x + 40, 190, 120, 200);
  // ceiling stains
  g.fillStyle(0x1a2218, 0.55);
  g.fillEllipse(x + 420, CEILING_Y + 24, 180, 40);
  g.fillEllipse(x + 680, CEILING_Y + 18, 140, 30);
  g.fillStyle(0x243028, 0.35);
  g.fillEllipse(x + 430, CEILING_Y + 28, 80, 16);
  // side puddles (main gap is drawn as an obstacle)
  g.fillStyle(0x1a2830, 0.45);
  g.fillEllipse(x + 700, FLOOR_Y + 14, 90, 14);
  g.fillStyle(0x8ab0c0, 0.1);
  g.fillEllipse(x + 700, FLOOR_Y + 12, 50, 6);
  // buckets
  for (const bx of [360, 660]) {
    g.fillStyle(C.metal, 1);
    g.fillRect(x + bx, FLOOR_Y - 36, 36, 36);
    g.fillStyle(C.metalLite, 1);
    g.fillEllipse(x + bx + 18, FLOOR_Y - 36, 36, 10);
    g.fillStyle(0x1a2830, 0.6);
    g.fillEllipse(x + bx + 18, FLOOR_Y - 36, 24, 6);
  }
  // wall water trails
  g.fillStyle(0x1c2420, 0.4);
  g.fillRect(x + 500, CEILING_Y + 8, 6, 120);
  g.fillRect(x + 760, CEILING_Y + 8, 5, 90);
}

function furnitureCross(g: G, r: BakedRoom): void {
  const x = r.worldX;
  drawWindow(g, x + 180, 160, 200, 260, 0x141820, 0x243040);
  // open door on the right wall of the room (night beyond)
  const dx = x + 820;
  g.fillStyle(C.woodDark, 1);
  g.fillRect(dx - 12, 180, 150, FLOOR_Y - 180);
  g.fillGradientStyle(C.night, C.night, C.nightLite, C.nightLite, 1, 1, 1, 1);
  g.fillRect(dx, 196, 126, FLOOR_Y - 204);
  g.fillStyle(C.wood, 1);
  g.fillRect(dx - 12, 180, 150, 16);
  g.fillRect(dx - 12, 196, 12, FLOOR_Y - 204);
  g.fillRect(dx + 126, 196, 12, FLOOR_Y - 204);
  // door leaf parked open
  g.fillStyle(C.woodMid, 1);
  g.fillRect(dx - 70, 196, 58, FLOOR_Y - 204);
  g.fillStyle(C.trim, 1);
  g.fillCircle(dx - 22, 400, 5);
  drawTable(g, x + 480, FLOOR_Y - 78, 140, 78);
}

function furnitureAttic(g: G, r: BakedRoom): void {
  const x = r.worldX;
  const w = r.width;
  g.fillStyle(0x0c0a08, 1);
  g.fillTriangle(x, CEILING_Y, x, CEILING_Y + 170, x + w * 0.5, CEILING_Y);
  g.fillTriangle(x + w, CEILING_Y, x + w, CEILING_Y + 170, x + w * 0.5, CEILING_Y);
  g.fillStyle(C.woodDeep, 1);
  g.fillTriangle(x, CEILING_Y, x + 18, CEILING_Y + 170, x + 36, CEILING_Y);
  g.fillTriangle(x + w, CEILING_Y, x + w - 18, CEILING_Y + 170, x + w - 36, CEILING_Y);
  // vent grille
  const vx = x + 470;
  g.fillStyle(C.metal, 1);
  g.fillRect(vx - 50, CEILING_Y - 4, 100, 28);
  g.fillStyle(0x0a0a0c, 1);
  for (let i = 0; i < 5; i++) {
    g.fillRect(vx - 42 + i * 18, CEILING_Y + 2, 10, 16);
  }
  // crates
  g.fillStyle(C.wood, 1);
  g.fillRect(x + 80, FLOOR_Y - 70, 90, 70);
  g.fillRect(x + 150, FLOOR_Y - 46, 70, 46);
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x + 80, FLOOR_Y - 48, 90, 6);
  g.fillRect(x + 760, FLOOR_Y - 90, 80, 90);
  g.fillRect(x + 820, FLOOR_Y - 50, 60, 50);
  drawWindow(g, x + 700, 250, 90, 110, 0x101018, 0x1c1c28);
}

function furnitureStairwell(g: G, r: BakedRoom): void {
  const x = r.worldX;
  drawWindow(g, x + 200, 150, 110, 170);
  drawWindow(g, x + 1100, 150, 110, 170);
  // stairs climbing along the back wall, landing in the calm pocket
  g.fillStyle(C.woodDark, 1);
  const stepW = 36;
  for (let i = 0; i < 13; i++) {
    const sx = x + 80 + i * stepW;
    const sy = FLOOR_Y - 24 - i * 18;
    g.fillRect(sx, sy, stepW + 4, 20);
    g.fillStyle(C.woodMid, 1);
    g.fillRect(sx, sy, stepW + 4, 5);
    g.fillStyle(C.woodDark, 1);
  }
  // mid landing
  const lx = x + 560;
  g.fillStyle(C.woodMid, 1);
  g.fillRect(lx, FLOOR_Y - 258, 240, 14);
  g.fillStyle(C.trim, 1);
  g.fillRect(lx, FLOOR_Y - 280, 8, 280);
  g.fillRect(lx + 232, FLOOR_Y - 280, 8, 36);
  g.fillRect(lx, FLOOR_Y - 280, 240, 8);
  // continuing stairs
  for (let i = 0; i < 14; i++) {
    const sx = x + 800 + i * stepW;
    const sy = FLOOR_Y - 258 - i * 16;
    g.fillStyle(C.woodDark, 1);
    g.fillRect(sx, sy, stepW + 4, 18);
    g.fillStyle(C.woodMid, 1);
    g.fillRect(sx, sy, stepW + 4, 5);
  }
  // newel and rail along the walk
  g.fillStyle(C.trim, 1);
  g.fillRect(x + 70, FLOOR_Y - 110, 10, 110);
  g.fillRect(x + 70, FLOOR_Y - 110, r.width - 200, 7);
  // bench on the calm landing (floor, readable pocket)
  g.fillStyle(C.wood, 1);
  g.fillRect(lx + 40, FLOOR_Y - 62, 160, 14);
  g.fillRect(lx + 48, FLOOR_Y - 48, 8, 48);
  g.fillRect(lx + 184, FLOOR_Y - 48, 8, 48);
  drawRug(g, lx + 20, FLOOR_Y - 8, 200, 40, 0x3a2a1c);
}

function furnitureStorm(g: G, r: BakedRoom): void {
  const x = r.worldX;
  // large storm window
  drawWindow(g, x + 280, 140, 420, 300, 0x10141c, 0x1c2430);
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x + 262, 122, 456, 16);
  // shutters open
  g.fillStyle(C.woodMid, 1);
  g.fillRect(x + 220, 140, 50, 300);
  g.fillRect(x + 710, 140, 50, 300);
  g.lineStyle(2, C.woodDeep, 0.7);
  g.strokeRect(x + 226, 150, 38, 130);
  g.strokeRect(x + 226, 290, 38, 130);
  g.strokeRect(x + 716, 150, 38, 130);
  g.strokeRect(x + 716, 290, 38, 130);
  // plant
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x + 80, FLOOR_Y - 40, 36, 40);
  g.fillStyle(0x1c2a18, 1);
  g.fillCircle(x + 98, FLOOR_Y - 64, 28);
  g.fillCircle(x + 80, FLOOR_Y - 80, 16);
  g.fillCircle(x + 116, FLOOR_Y - 78, 18);
  // calm pocket chair
  g.fillStyle(0x2a2420, 1);
  g.fillRoundedRect(x + 940, FLOOR_Y - 86, 90, 86, 8);
  g.fillRoundedRect(x + 948, FLOOR_Y - 128, 74, 50, 8);
}

function furnitureLanding(g: G, r: BakedRoom): void {
  const x = r.worldX;
  drawWindow(g, x + 200, 170, 160, 230);
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x + 188, 158, 184, 8);
  // plant and table
  drawTable(g, x + 430, FLOOR_Y - 72, 110, 72, 14);
  g.fillStyle(0x2a1a10, 1);
  g.fillEllipse(x + 485, FLOOR_Y - 80, 40, 14);
  g.fillStyle(0x1a2816, 1);
  g.fillCircle(x + 485, FLOOR_Y - 112, 32);
  g.fillCircle(x + 468, FLOOR_Y - 130, 16);
  g.fillCircle(x + 504, FLOOR_Y - 128, 14);
  drawRug(g, x + 120, FLOOR_Y - 12, 500, 50, 0x3a2a20);
  // last curtain rod (drape dynamic)
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x + 760, 158, 180, 8);
}


function drawVaultSofa(g: G, worldX: number, obs: Extract<Obstacle, { kind: "vault" }>): void {
  const x = worldX + obs.x;
  const h = obs.h;
  const w = obs.w;
  g.fillStyle(0x3a2a28, 1);
  g.fillRoundedRect(x, FLOOR_Y - h, w, h, 10);
  g.fillStyle(0x2e2220, 1);
  g.fillRoundedRect(x + 8, FLOOR_Y - h - 28, w * 0.34, 32, 8);
  g.fillRoundedRect(x + w * 0.58, FLOOR_Y - h - 28, w * 0.34, 32, 8);
  g.fillStyle(0x241818, 0.9);
  g.fillRect(x + 4, FLOOR_Y - 14, w - 8, 14);
  // subtle highlight so it reads as a blocker
  g.fillStyle(0xc8b090, 0.08);
  g.fillRoundedRect(x + 10, FLOOR_Y - h + 8, w - 20, 18, 6);
}

function drawCrawlBeam(g: G, worldX: number, obs: Extract<Obstacle, { kind: "crawl" }>): void {
  const x = worldX + obs.x;
  const clear = obs.clearance;
  const w = obs.w;
  // Heavy beam / half-closed shutter hanging low
  g.fillStyle(C.woodDeep, 1);
  g.fillRect(x - 10, CEILING_Y, w + 20, 18);
  g.fillStyle(C.wood, 1);
  g.fillRect(x, CEILING_Y + 14, w, FLOOR_Y - clear - (CEILING_Y + 14));
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x, FLOOR_Y - clear - 14, w, 14);
  g.fillStyle(C.trim, 0.85);
  g.fillRect(x + 8, CEILING_Y + 28, 8, FLOOR_Y - clear - CEILING_Y - 50);
  g.fillRect(x + w - 16, CEILING_Y + 28, 8, FLOOR_Y - clear - CEILING_Y - 50);
  // open crawl mouth
  g.fillStyle(0x080604, 0.55);
  g.fillRect(x + 6, FLOOR_Y - clear, w - 12, clear);
  g.fillStyle(0xc8b090, 0.07);
  g.fillRect(x + 10, FLOOR_Y - clear + 4, w - 20, 10);
}

function drawFloorGap(g: G, worldX: number, obs: Extract<Obstacle, { kind: "gap" }>): void {
  const x = worldX + obs.x;
  const w = obs.w;
  // Dark pit / broken boards
  g.fillStyle(0x060504, 1);
  g.fillRect(x, FLOOR_Y - 2, w, GAME_H - FLOOR_Y + 2);
  g.fillGradientStyle(0x0c1014, 0x0c1014, 0x1a2830, 0x1a2830, 1, 1, 0.7, 0.7);
  g.fillRect(x + 4, FLOOR_Y + 8, w - 8, 40);
  // jagged board edges
  g.fillStyle(C.woodDark, 1);
  g.fillRect(x - 10, FLOOR_Y - 8, 14, 12);
  g.fillRect(x + w - 4, FLOOR_Y - 8, 14, 12);
  g.fillStyle(C.woodMid, 1);
  g.fillTriangle(x - 4, FLOOR_Y - 8, x + 18, FLOOR_Y - 8, x - 4, FLOOR_Y + 6);
  g.fillTriangle(x + w + 4, FLOOR_Y - 8, x + w - 18, FLOOR_Y - 8, x + w + 4, FLOOR_Y + 6);
  g.fillStyle(0x8ab0c0, 0.12);
  g.fillEllipse(x + w * 0.5, FLOOR_Y + 28, w * 0.7, 12);
}

function drawClosingDoorFrame(g: G, worldX: number, obs: Extract<Obstacle, { kind: "closingDoor" }>): void {
  const x = worldX + obs.x;
  const openW = obs.openW;
  g.fillStyle(C.wood, 1);
  g.fillRect(x - 12, 190, 14, FLOOR_Y - 190);
  g.fillRect(x + openW - 2, 190, 14, FLOOR_Y - 190);
  g.fillRect(x - 12, 176, openW + 24, 16);
  g.fillStyle(0x100c0a, 1);
  g.fillRect(x + 2, 192, openW - 4, FLOOR_Y - 192);
  // urgency stripe
  g.fillStyle(0xc45a2a, 0.25);
  g.fillRect(x - 4, 186, openW + 8, 6);
}

function drawObstacles(g: G, room: BakedRoom): void {
  const list = room.obstacles ?? [];
  for (const obs of list) {
    switch (obs.kind) {
      case "vault":
        drawVaultSofa(g, room.worldX, obs);
        break;
      case "crawl":
        drawCrawlBeam(g, room.worldX, obs);
        break;
      case "gap":
        drawFloorGap(g, room.worldX, obs);
        break;
      case "closingDoor":
        drawClosingDoorFrame(g, room.worldX, obs);
        break;
      default:
        break;
    }
  }
}

function drawFurniture(g: G, room: BakedRoom): void {
  switch (room.kind) {
    case "foyer":
      furnitureFoyer(g, room);
      break;
    case "hall":
      furnitureHall(g, room);
      break;
    case "frontDoor":
      furnitureFrontDoor(g, room);
      break;
    case "fan":
      furnitureFan(g, room);
      break;
    case "curtains":
      furnitureCurtains(g, room);
      break;
    case "kitchen":
      furnitureKitchen(g, room);
      break;
    case "leaky":
      furnitureLeaky(g, room);
      break;
    case "cross":
      furnitureCross(g, room);
      break;
    case "attic":
      furnitureAttic(g, room);
      break;
    case "stairwell":
      furnitureStairwell(g, room);
      break;
    case "storm":
      furnitureStorm(g, room);
      break;
    case "landing":
      furnitureLanding(g, room);
      break;
    default:
      break;
  }
}

export function drawStaticHouse(g: G, rooms: BakedRoom[]): void {
  g.clear();
  for (const room of rooms) drawShell(g, room);
  for (const room of rooms) drawFurniture(g, room);
  for (const room of rooms) drawObstacles(g, room);
  for (let i = 0; i < rooms.length; i++) {
    drawDoorway(g, rooms[i], i === rooms.length - 1);
  }
}
