import Phaser from "phaser";
import type { GameSdk } from "../kit/sdk";
import {
  C,
  CEILING_Y,
  CUP_SPEED_MUL,
  EXIT_MARGIN,
  FAIL_BEAT,
  FLAME_MAX,
  FLOOR_Y,
  FONT,
  GAME_H,
  GAME_W,
  START_OFFSET,
  UI_FONT,
  WALK_SPEED,
} from "./constants";
import { drawStaticHouse } from "./drawHouse";
import { bakeHouse, roomAt, type BakedRoom, type HouseLayout } from "./rooms";
import {
  fanAngle,
  flameDelta,
  gustEnvelope,
  periodicActive,
  sampleWind,
  updateGusts,
  type GustState,
  type WindSample,
} from "./wind";

type Mode = "title" | "playing" | "failing" | "won";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: number;
  kind: "dust" | "streak" | "drip" | "ember" | "puff";
};

const BLOCKED_KEYS = new Set([
  "Tab",
  "Escape",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "ContextMenu",
  "PrintScreen",
]);

function isBlockedKey(code: string): boolean {
  return BLOCKED_KEYS.has(code) || code.startsWith("F") && code.length <= 4;
}

function flicker(t: number, seed: number): number {
  return (
    Math.sin(t * 21 + seed) * 0.45 +
    Math.sin(t * 37 + seed * 1.7) * 0.32 +
    Math.sin(t * 59 + seed * 0.4) * 0.23
  );
}

export class PlayScene extends Phaser.Scene {
  private sdk!: GameSdk;
  private house!: HouseLayout;
  private mode: Mode = "title";
  private playerX = 0;
  private flame = FLAME_MAX;
  private attempts = 0;
  private failTimer = 0;
  private gusts: GustState = {};
  private particles: Particle[] = [];
  private keysHeld = new Set<string>();
  private pointerHeld = false;
  private leanX = 0;
  private leanY = 0;
  private walkPhase = 0;
  private spawnAcc = 0;

  private worldGfx!: Phaser.GameObjects.Graphics;
  private dynGfx!: Phaser.GameObjects.Graphics;
  private glowGfx!: Phaser.GameObjects.Graphics;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!: Phaser.GameObjects.Graphics;
  private darkGfx!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private follower!: Phaser.GameObjects.Container;

  private titleText!: Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private attemptText!: Phaser.GameObjects.Text;

  constructor() {
    super("play");
  }

  create(): void {
    this.sdk = this.registry.get("sdk") as GameSdk;
    this.house = bakeHouse();
    this.playerX = this.house.rooms[0].worldX + START_OFFSET;

    this.worldGfx = this.add.graphics().setDepth(0);
    drawStaticHouse(this.worldGfx, this.house.rooms);

    this.dynGfx = this.add.graphics().setDepth(4);
    this.darkGfx = this.add.graphics().setDepth(8).setScrollFactor(0);
    this.glowGfx = this.add.graphics().setDepth(10);
    this.playerGfx = this.add.graphics().setDepth(12);
    this.fxGfx = this.add.graphics().setDepth(14);
    this.hudGfx = this.add.graphics().setDepth(20).setScrollFactor(0);

    this.follower = this.add.container(this.playerX, FLOOR_Y - 90);
    this.cameras.main.setBounds(0, 0, this.house.width, GAME_H);
    this.cameras.main.startFollow(this.follower, true, 0.14, 0.08);
    this.cameras.main.setFollowOffset(240, 36);
    this.cameras.main.centerOn(this.playerX + 240, GAME_H * 0.5);

    const titleStyle = {
      fontFamily: FONT,
      fontSize: "84px",
      color: C.text,
      align: "center" as const,
    };
    this.titleText = this.add
      .text(GAME_W * 0.5, 168, "Keep Lit", titleStyle)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22)
      .setShadow(0, 10, "#000000", 18, true, true);
    this.taglineText = this.add
      .text(GAME_W * 0.5, 262, "Hold to cup the flame. Release to let it breathe.", {
        fontFamily: FONT,
        fontSize: "26px",
        color: C.textDim,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22);
    this.promptText = this.add
      .text(GAME_W * 0.5, 330, "Press to begin", {
        fontFamily: FONT,
        fontSize: "20px",
        color: C.textMute,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22);
    this.bannerText = this.add
      .text(GAME_W * 0.5, 300, "", {
        fontFamily: FONT,
        fontSize: "44px",
        color: C.text,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22)
      .setAlpha(0)
      .setShadow(0, 8, "#000000", 14, true, true);
    this.bannerSub = this.add
      .text(GAME_W * 0.5, 360, "", {
        fontFamily: FONT,
        fontSize: "20px",
        color: C.textDim,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22)
      .setAlpha(0);
    this.roomText = this.add
      .text(48, 28, "", {
        fontFamily: FONT,
        fontSize: "26px",
        color: C.textDim,
      })
      .setScrollFactor(0)
      .setDepth(22)
      .setAlpha(0);
    this.attemptText = this.add
      .text(GAME_W - 48, 32, "", {
        fontFamily: UI_FONT,
        fontSize: "16px",
        color: C.textMute,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(22)
      .setAlpha(0);

    this.bindInput();
    this.sdk.loadingStop();
    if (import.meta.env.DEV && this.devRoomIndex() !== null) this.beginRun();
  }

  private devRoomIndex(): number | null {
    if (!import.meta.env.DEV) return null;
    const raw = new URLSearchParams(window.location.search).get("room");
    const idx = raw === null ? Number.NaN : Number(raw);
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.house.rooms.length) return null;
    return idx;
  }

  private bindInput(): void {
    this.input.on("pointerdown", () => {
      this.pointerHeld = true;
      this.onPress();
    });
    this.input.on("pointerup", () => {
      this.pointerHeld = false;
    });
    this.input.on("pointerupoutside", () => {
      this.pointerHeld = false;
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isBlockedKey(event.code)) return;
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      this.keysHeld.add(event.code);
      this.onPress();
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => {
      this.keysHeld.delete(event.code);
    });
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      this.keysHeld.clear();
      this.pointerHeld = false;
    });
  }

  private cupped(): boolean {
    return this.pointerHeld || this.keysHeld.size > 0;
  }

  private onPress(): void {
    if (this.mode === "title" || this.mode === "won") this.beginRun();
  }

  private beginRun(): void {
    this.attempts += 1;
    this.mode = "playing";
    const jump = this.devRoomIndex();
    const startRoom = jump === null ? this.house.rooms[0] : this.house.rooms[jump];
    this.playerX = startRoom.worldX + Math.min(START_OFFSET, startRoom.width * 0.35);
    this.flame = FLAME_MAX;
    this.failTimer = 0;
    this.gusts = {};
    this.particles = [];
    this.leanX = 0;
    this.leanY = 0;
    this.walkPhase = 0;
    this.follower.setPosition(this.playerX, FLOOR_Y - 90);
    this.cameras.main.centerOn(this.playerX + 240, GAME_H * 0.5);
    this.titleText.setAlpha(0);
    this.taglineText.setAlpha(0);
    this.promptText.setAlpha(0);
    this.bannerText.setAlpha(0);
    this.bannerSub.setAlpha(0);
    this.roomText.setAlpha(1);
    this.attemptText.setAlpha(1);
    this.sdk.gameplayStart();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    const timeSec = this.time.now / 1000;
    const held = this.cupped();

    if (this.mode === "playing") {
      updateGusts(this.house.rooms, this.playerX, timeSec, this.gusts);
      const wind = sampleWind(this.house.rooms, this.playerX, timeSec, this.gusts);
      this.flame = Phaser.Math.Clamp(this.flame + flameDelta(held, wind, dt), 0, FLAME_MAX);
      const speed = WALK_SPEED * (held ? CUP_SPEED_MUL : 1);
      this.playerX = Math.min(this.house.width - EXIT_MARGIN + 8, this.playerX + speed * dt);
      this.walkPhase += speed * dt * 0.085;
      this.leanX += (wind.dx * wind.strength * (held ? 0.32 : 1) - this.leanX) * Math.min(1, dt * 7);
      this.leanY += (wind.dy * wind.strength * (held ? 0.32 : 1) - this.leanY) * Math.min(1, dt * 7);
      this.spawnFx(dt, timeSec, wind, held);
      if (this.flame <= 0) this.failRun();
      else if (this.playerX >= this.house.width - EXIT_MARGIN) this.winRun();
    } else if (this.mode === "failing") {
      this.failTimer -= dt;
      this.flame = 0;
      this.leanX *= 1 - dt * 4;
      this.leanY *= 1 - dt * 4;
      this.spawnSnuff(dt);
      if (this.failTimer <= 0) this.beginRun();
    } else if (this.mode === "title") {
      const idle: WindSample = { strength: 0.05, dx: 0.15, dy: 0, rain: 0 };
      this.leanX += (0.08 - this.leanX) * dt * 3;
      this.leanY += (0 - this.leanY) * dt * 3;
      this.spawnFx(dt, timeSec, idle, false);
      this.promptText.setAlpha(0.45 + Math.sin(timeSec * 2.2) * 0.35);
    } else if (this.mode === "won") {
      this.leanX += (0 - this.leanX) * dt * 3;
      this.leanY += (0 - this.leanY) * dt * 3;
      this.promptText.setAlpha(0.45 + Math.sin(timeSec * 2.2) * 0.35);
    }

    this.follower.setPosition(this.playerX, FLOOR_Y - 90);
    this.drawDynamics(timeSec, held);
    this.drawGlow(held);
    this.drawPerson(timeSec, held);
    this.drawParticles(dt);
    this.drawVignette();
    this.drawHud();
    this.refreshCopy(timeSec);
  }

  private failRun(): void {
    this.mode = "failing";
    this.failTimer = FAIL_BEAT;
    this.flame = 0;
    this.sdk.gameplayStop();
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.push({
        x: this.playerX + 18,
        y: FLOOR_Y - 118,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.28 + Math.random() * 0.2,
        max: 0.4,
        size: 3 + Math.random() * 5,
        color: C.flame,
        kind: "puff",
      });
    }
  }

  private winRun(): void {
    this.mode = "won";
    this.sdk.gameplayStop();
    this.roomText.setAlpha(1);
    this.promptText.setText("Press to walk it again").setAlpha(1);
  }

  private spawnFx(dt: number, timeSec: number, wind: WindSample, held: boolean): void {
    this.spawnAcc += dt;
    const rate = 0.016;
    while (this.spawnAcc >= rate) {
      this.spawnAcc -= rate;
      this.spawnZoneParticles(timeSec);
      if (this.mode === "playing" || this.mode === "title") {
        if (Math.random() < 0.35) {
          const low = this.flame / FLAME_MAX;
          this.particles.push({
            x: this.playerX + 20 + this.leanX * 10,
            y: FLOOR_Y - 124 - low * 10,
            vx: this.leanX * 30 + (Math.random() - 0.5) * 12,
            vy: -20 - Math.random() * 30,
            life: 0.3 + Math.random() * 0.25,
            max: 0.5,
            size: 2 + Math.random() * 2,
            color: held ? C.flameMid : C.flame,
            kind: "ember",
          });
        }
      }
    }
    if (wind.strength > 0.2 && this.mode === "playing") {
      const n = wind.strength > 0.7 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        this.particles.push({
          x: this.playerX - wind.dx * 80 + (Math.random() - 0.5) * 40,
          y: FLOOR_Y - 70 - Math.random() * 200,
          vx: wind.dx * (180 + wind.strength * 220),
          vy: wind.dy * (160 + wind.strength * 140) + (Math.random() - 0.5) * 20,
          life: 0.35 + Math.random() * 0.3,
          max: 0.6,
          size: 2 + Math.random() * 8,
          color: 0xc4b49a,
          kind: "streak",
        });
      }
    }
  }

  private spawnZoneParticles(timeSec: number): void {
    const cam = this.cameras.main.worldView;
    for (const room of this.house.rooms) {
      if (room.worldX + room.width < cam.x - 40 || room.worldX > cam.right + 40) continue;
      for (const hazard of room.hazards) {
        if (hazard.kind === "rain") {
          const x = room.worldX + hazard.x + Math.random() * hazard.w;
          this.particles.push({
            x,
            y: CEILING_Y + 8,
            vx: 18,
            vy: 280 + Math.random() * 120,
            life: 0.9,
            max: 0.9,
            size: 2,
            color: 0x9eb8c8,
            kind: "drip",
          });
        } else if (hazard.kind === "draft" || hazard.kind === "chimney" || hazard.kind === "vent") {
          if (Math.random() > 0.5) continue;
          const x = room.worldX + hazard.x + Math.random() * hazard.w;
          const dir = hazard.kind === "vent" ? { x: 0, y: -1 } : hazard.kind === "draft" ? hazard.dir : hazard.dir;
          this.particles.push({
            x,
            y: hazard.kind === "vent" ? FLOOR_Y - 40 - Math.random() * 200 : FLOOR_Y - 40 - Math.random() * 280,
            vx: dir.x * (70 + Math.random() * 90),
            vy: dir.y * (70 + Math.random() * 90),
            life: 0.7,
            max: 0.7,
            size: 2 + Math.random() * 3,
            color: 0xc4b49a,
            kind: "dust",
          });
        } else if (hazard.kind === "periodic") {
          const on = periodicActive(hazard, timeSec);
          if (on <= 0.05 || Math.random() > 0.65) continue;
          const x = room.worldX + hazard.x + Math.random() * hazard.w;
          this.particles.push({
            x,
            y: FLOOR_Y - 50 - Math.random() * 260,
            vx: hazard.dir.x * (140 + on * 160),
            vy: hazard.dir.y * (80 + on * 80),
            life: 0.45,
            max: 0.45,
            size: 3 + Math.random() * 6,
            color: 0xd0c0a8,
            kind: "streak",
          });
        } else if (hazard.kind === "approachGust") {
          const env = gustEnvelope(hazard, this.gusts[hazard.id]?.openedAt ?? null, timeSec);
          if (env.wind <= 0.1) continue;
          const x = room.worldX + hazard.gustX + Math.random() * hazard.gustW * 0.4;
          this.particles.push({
            x,
            y: 220 + Math.random() * 300,
            vx: hazard.dir.x * (200 + env.wind * 260),
            vy: (Math.random() - 0.4) * 60,
            life: 0.4,
            max: 0.4,
            size: 4 + Math.random() * 8,
            color: 0xd8c8b0,
            kind: "streak",
          });
        }
      }
    }
  }

  private spawnSnuff(dt: number): void {
    if (Math.random() < dt * 8) {
      this.particles.push({
        x: this.playerX + 16 + (Math.random() - 0.5) * 20,
        y: FLOOR_Y - 110,
        vx: (Math.random() - 0.5) * 30,
        vy: -10 - Math.random() * 20,
        life: 0.4,
        max: 0.4,
        size: 6 + Math.random() * 8,
        color: 0x665544,
        kind: "puff",
      });
    }
  }

  private drawDynamics(timeSec: number, held: boolean): void {
    const g = this.dynGfx;
    g.clear();
    const cam = this.cameras.main.worldView;
    for (const room of this.house.rooms) {
      if (room.worldX + room.width < cam.x - 80 || room.worldX > cam.right + 80) continue;
      this.drawRoomDynamics(g, room, timeSec, held);
    }
  }

  private drawRoomDynamics(g: Phaser.GameObjects.Graphics, room: BakedRoom, timeSec: number, _held: boolean): void {
    const x = room.worldX;
    if (room.kind === "foyer") {
      this.drawCurtain(g, x + 548, 162, 70, 250, timeSec, 0.35, 0.6);
      this.drawCurtain(g, x + 692, 162, 70, 250, timeSec, 0.35, 1.4);
    }
    if (room.kind === "hall") {
      for (const [wx, phase] of [
        [170, 0.2],
        [490, 0.8],
        [810, 1.5],
      ] as const) {
        this.drawCurtain(g, x + wx - 8, 166, 56, 230, timeSec, 0.85, phase);
        this.drawCurtain(g, x + wx + 102, 166, 56, 230, timeSec, 0.85, phase + 0.7);
      }
    }
    if (room.kind === "frontDoor") {
      const hazard = room.hazards[0];
      if (hazard.kind === "approachGust") {
        const env = gustEnvelope(hazard, this.gusts[hazard.id]?.openedAt ?? null, timeSec);
        this.drawSwingingDoor(g, x + 430, 186, 140, FLOOR_Y - 194, env.open, 1);
      }
    }
    if (room.kind === "fan") {
      const hazard = room.hazards[0];
      if (hazard.kind === "fan") this.drawFan(g, x + hazard.x, timeSec, hazard);
    }
    if (room.kind === "curtains") {
      const pulse = room.hazards[0]?.kind === "periodic" ? periodicActive(room.hazards[0], timeSec) : 0.4;
      for (const [wx, phase] of [
        [144, 0],
        [484, 0.6],
        [824, 1.2],
      ] as const) {
        this.drawCurtain(g, x + wx, 146, 80, 300, timeSec, 0.7 + pulse * 0.8, phase);
        this.drawCurtain(g, x + wx + 120, 146, 80, 300, timeSec, 0.7 + pulse * 0.8, phase + 0.5);
      }
    }
    if (room.kind === "kitchen") {
      const hazard = room.hazards[0];
      if (hazard.kind === "approachGust") {
        const env = gustEnvelope(hazard, this.gusts[hazard.id]?.openedAt ?? null, timeSec);
        const swing = env.open > 0 ? Math.sin(Math.min(1, env.open + (1 - env.wind) * 0.2) * Math.PI) : 0;
        this.drawSwingingDoor(g, x + 426, 202, 80, FLOOR_Y - 202, swing, -1);
      }
    }
    if (room.kind === "landing") {
      const local = this.playerX - x;
      const amp = local > 700 ? 0.7 : 0.12;
      this.drawCurtain(g, x + 760, 166, 80, 280, timeSec, amp, 0.4);
      this.drawCurtain(g, x + 850, 166, 86, 280, timeSec, amp, 1.1);
    }
    if (room.kind === "storm") {
      this.drawStormGlass(g, x + 280, 140, 420, 300, timeSec);
    }
  }

  private drawCurtain(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    timeSec: number,
    amp: number,
    phase: number,
  ): void {
    const folds = 5;
    g.fillStyle(C.curtain, 0.92);
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const wave = Math.sin(t * 3 + timeSec * (1.8 + amp) + phase) * (8 + amp * 16) * t;
      g.lineTo(x + w + wave, y + h * t);
    }
    g.lineTo(x, y + h);
    g.closePath();
    g.fillPath();
    g.fillStyle(C.curtainLite, 0.35);
    for (let f = 1; f < folds; f++) {
      const fx = x + (w * f) / folds;
      g.beginPath();
      g.moveTo(fx, y);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const wave = Math.sin(t * 2.6 + timeSec * 2 + phase + f) * (6 + amp * 12) * t;
        g.lineTo(fx + wave, y + h * t);
      }
      g.lineTo(fx, y);
      g.closePath();
      g.fillPath();
    }
  }

  private drawSwingingDoor(
    g: Phaser.GameObjects.Graphics,
    hingeX: number,
    y: number,
    w: number,
    h: number,
    open: number,
    dir: number,
  ): void {
    const angle = open * 1.15 * dir;
    const tipX = hingeX + Math.cos(angle) * w;
    const tipOffset = Math.sin(Math.abs(angle)) * 18;
    g.fillStyle(C.wood, 1);
    g.beginPath();
    g.moveTo(hingeX, y);
    g.lineTo(tipX, y + tipOffset);
    g.lineTo(tipX, y + h - tipOffset * 0.3);
    g.lineTo(hingeX, y + h);
    g.closePath();
    g.fillPath();
    g.fillStyle(C.woodDark, 1);
    g.fillRect(hingeX - 3, y, 6, h);
    g.fillStyle(C.trim, 1);
    g.fillCircle(hingeX + Math.cos(angle) * (w - 16), y + h * 0.55, 4);
  }

  private drawFan(
    g: Phaser.GameObjects.Graphics,
    fx: number,
    timeSec: number,
    hazard: Extract<import("./rooms").Hazard, { kind: "fan" }>,
  ): void {
    const heading = fanAngle(hazard, timeSec);
    const fy = FLOOR_Y - 78;
    // wind cone
    const reach = hazard.reach;
    const a0 = heading - hazard.cone;
    const a1 = heading + hazard.cone;
    g.fillStyle(0xc8d8e0, 0.07);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(fx + Math.cos(a0) * reach, fy + Math.sin(a0) * reach);
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6;
      g.lineTo(fx + Math.cos(a) * reach, fy + Math.sin(a) * reach);
    }
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xd0e0e8, 0.16);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(fx + Math.cos(heading) * reach, fy + Math.sin(heading) * reach);
    g.strokePath();
    g.lineStyle(1, 0xd0e0e8, 0.1);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(fx + Math.cos(a0) * reach, fy + Math.sin(a0) * reach);
    g.moveTo(fx, fy);
    g.lineTo(fx + Math.cos(a1) * reach, fy + Math.sin(a1) * reach);
    g.strokePath();
    // blades
    const spin = timeSec * 14;
    g.fillStyle(C.metalLite, 0.9);
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI * 2) / 3;
      g.beginPath();
      g.moveTo(fx, fy);
      g.lineTo(fx + Math.cos(a) * 36, fy + Math.sin(a) * 10 - 4);
      g.lineTo(fx + Math.cos(a + 0.5) * 38, fy + Math.sin(a + 0.5) * 10);
      g.closePath();
      g.fillPath();
    }
    g.fillStyle(C.metal, 1);
    g.fillCircle(fx, fy, 8);
  }

  private drawStormGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, timeSec: number): void {
    g.fillStyle(0x9eb0c0, 0.18);
    for (let i = 0; i < 16; i++) {
      const px = x + ((i * 47 + timeSec * 80) % w);
      const py = y + ((i * 79 + timeSec * 240) % h);
      g.fillRect(px, py, 2, 16);
    }
  }

  private drawPerson(timeSec: number, held: boolean): void {
    const g = this.playerGfx;
    g.clear();
    const walking = this.mode === "playing";
    const step = walking ? Math.sin(this.walkPhase) : 0;
    const bob = walking ? Math.cos(this.walkPhase * 2) * (held ? 1.2 : 2.2) : Math.sin(timeSec * 2) * 0.6;
    const x = this.playerX;
    const feet = FLOOR_Y + bob;
    const cup = held && this.mode === "playing";

    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(x + 4, FLOOR_Y + 6, 50, 12);

    const legSpan = walking ? step * (cup ? 9 : 16) : 0;
    g.fillStyle(C.pants, 1);
    g.fillRoundedRect(x - 14 + legSpan, feet - 62, 13, 62, 5);
    g.fillRoundedRect(x + 2 - legSpan, feet - 62, 13, 62, 5);
    g.fillStyle(0x12100e, 1);
    g.fillRoundedRect(x - 16 + legSpan, feet - 12, 16, 12, 3);
    g.fillRoundedRect(x + 2 - legSpan, feet - 12, 16, 12, 3);

    const torsoH = cup ? 58 : 64;
    const torsoY = feet - 62 - torsoH;
    g.fillStyle(C.coat, 1);
    g.fillRoundedRect(x - 18, torsoY, 38, torsoH + 8, 10);
    g.fillStyle(C.coatLite, 0.5);
    g.fillRect(x + 2, torsoY + 8, 6, torsoH - 16);

    const headY = torsoY - 28;
    g.fillStyle(C.skin, 1);
    g.fillCircle(x + 2, headY, 16);
    g.fillStyle(C.hair, 1);
    g.fillEllipse(x + 1, headY - 8, 30, 20);
    g.fillRect(x - 14, headY - 8, 8, 22);

    const flameX = x + 22 + this.leanX * 10;
    const flameY = torsoY + 8 + this.leanY * 12;
    if (cup) {
      g.fillStyle(C.coatLite, 1);
      g.fillRoundedRect(x - 6, flameY - 4, 20, 22, 8);
      g.fillRoundedRect(x + 16, flameY - 4, 20, 22, 8);
      g.fillStyle(C.skin, 1);
      g.fillCircle(x - 2, flameY + 10, 6);
      g.fillCircle(x + 32, flameY + 10, 6);
    } else {
      g.fillStyle(C.coat, 1);
      g.fillRoundedRect(x + 14, torsoY + 10, 12, 36, 5);
      g.fillStyle(C.skin, 1);
      g.fillCircle(x + 26, torsoY + 44, 6);
      g.fillRoundedRect(x - 24, torsoY + 16, 10, 30, 4);
    }

    this.drawFlame(g, flameX, flameY, cup, timeSec);
  }

  private drawFlame(g: Phaser.GameObjects.Graphics, x: number, y: number, cupped: boolean, timeSec: number): void {
    const live = this.mode !== "failing" && this.flame > 0;
    g.fillStyle(0xd8c8a8, 1);
    g.fillRect(x - 3, y + 10, 6, 22);
    g.fillStyle(0xc0a070, 1);
    g.fillRect(x - 5, y + 30, 10, 3);
    if (!live) {
      g.fillStyle(0x4a4038, 0.7);
      g.fillCircle(x, y + 8, 4);
      return;
    }
    const t = this.flame / FLAME_MAX;
    const amp = (1.1 - t) * 1.4 + (Math.hypot(this.leanX, this.leanY) * 0.8);
    const flick = flicker(timeSec * (cupped ? 0.7 : 1.2), 1) * amp * (cupped ? 0.4 : 1);
    const lean = this.leanX * 16 * (cupped ? 0.35 : 1);
    const up = this.leanY * 10;
    const h = (cupped ? 18 : 24) * (0.45 + t * 0.7) + flick * 6;
    const w = (cupped ? 8 : 11) * (0.5 + t * 0.6);
    g.fillStyle(C.flameDeep, 0.85);
    this.flameBlob(g, x + lean * 0.4, y + up * 0.3, w * 1.3, h * 0.7);
    g.fillStyle(C.flame, 0.95);
    this.flameBlob(g, x + lean * 0.7, y - 2 + up * 0.6, w, h);
    g.fillStyle(C.flameMid, 0.95);
    this.flameBlob(g, x + lean * 0.9, y - 6 + up, w * 0.62, h * 0.72);
    g.fillStyle(C.flameCore, 0.95);
    this.flameBlob(g, x + lean, y - 4 + up * 1.1, w * 0.32, h * 0.4);
  }

  private flameBlob(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.beginPath();
    g.moveTo(x, y - h);
    g.lineTo(x + w, y - h * 0.25);
    g.lineTo(x + w * 0.45, y + h * 0.35);
    g.lineTo(x - w * 0.45, y + h * 0.35);
    g.lineTo(x - w, y - h * 0.25);
    g.closePath();
    g.fillPath();
  }

  private drawGlow(held: boolean): void {
    const g = this.glowGfx;
    g.clear();
    if (this.flame <= 0) return;
    const t = this.flame / FLAME_MAX;
    const x = this.playerX + 22 + this.leanX * 10;
    const y = FLOOR_Y - 118 + this.leanY * 12;
    const scale = (held ? 0.78 : 1) * (0.4 + t * 0.7);
    const rings: Array<[number, number, number]> = [
      [220 * scale, C.flameDeep, 0.05],
      [140 * scale, C.flame, 0.08],
      [80 * scale, C.flameMid, 0.16],
      [36 * scale, C.flameCore, 0.28],
    ];
    for (const [r, color, a] of rings) {
      g.fillStyle(color, a);
      g.fillCircle(x, y, r);
    }
    g.fillStyle(C.flame, 0.07 * t);
    g.fillEllipse(this.playerX + 4, FLOOR_Y + 2, 90 * scale, 18);
  }

  private drawParticles(dt: number): void {
    const g = this.fxGfx;
    g.clear();
    const next: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "drip" && p.y >= FLOOR_Y) {
        p.y = FLOOR_Y;
        p.vy = 0;
        p.vx *= 0.3;
        p.kind = "puff";
        p.size = 8;
        p.life = Math.min(p.life, 0.18);
      }
      if (p.kind === "ember") p.vy -= 20 * dt;
      if (p.kind === "puff") {
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.size += 18 * dt;
      }
      const a = Math.max(0, p.life / p.max);
      if (p.kind === "streak") {
        g.lineStyle(Math.max(1, p.size * 0.35), p.color, 0.18 * a);
        g.lineBetween(p.x, p.y, p.x - p.vx * 0.08, p.y - p.vy * 0.08);
      } else if (p.kind === "drip") {
        g.fillStyle(p.color, 0.45 * a);
        g.fillRect(p.x, p.y, 2, 10);
      } else {
        g.fillStyle(p.color, (p.kind === "dust" ? 0.28 : 0.45) * a);
        g.fillCircle(p.x, p.y, p.size);
      }
      next.push(p);
    }
    this.particles = next.length > 420 ? next.slice(next.length - 420) : next;
  }

  private drawVignette(): void {
    const g = this.darkGfx;
    g.clear();
    const t = this.mode === "failing" ? 0 : this.flame / FLAME_MAX;
    const edge = 0.22 + (1 - t) * 0.38;
    g.fillGradientStyle(0x080604, 0x080604, 0x080604, 0x080604, edge, edge, 0, 0);
    g.fillRect(0, 0, GAME_W, 170);
    g.fillGradientStyle(0x080604, 0x080604, 0x080604, 0x080604, 0, 0, edge, edge);
    g.fillRect(0, GAME_H - 160, GAME_W, 160);
    g.fillGradientStyle(0x080604, 0x080604, 0x080604, 0x080604, edge, 0, edge, 0);
    g.fillRect(0, 0, 220, GAME_H);
    g.fillGradientStyle(0x080604, 0x080604, 0x080604, 0x080604, 0, edge, 0, edge);
    g.fillRect(GAME_W - 180, 0, 180, GAME_H);
  }

  private drawHud(): void {
    const g = this.hudGfx;
    g.clear();
    if (this.mode === "title") return;
    const t = this.flame / FLAME_MAX;
    const x = GAME_W * 0.5 - 110;
    const y = 30;
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(x - 8, y - 8, 236, 22, 8);
    g.fillStyle(0x2a2018, 0.9);
    g.fillRoundedRect(x, y - 2, 220, 10, 4);
    const col = t > 0.45 ? C.flame : t > 0.2 ? 0xff8a3a : 0xff5a2a;
    g.fillStyle(col, 0.95);
    g.fillRoundedRect(x, y - 2, Math.max(0, 220 * t), 10, 4);
    if (t > 0.02) {
      g.fillStyle(C.flameCore, 0.35);
      g.fillRoundedRect(x, y - 2, Math.max(0, 220 * t), 5, 3);
    }
  }

  private refreshCopy(timeSec: number): void {
    if (this.mode === "title") {
      this.titleText.setAlpha(1);
      this.taglineText.setAlpha(1);
      return;
    }
    const room = roomAt(this.house.rooms, this.playerX);
    this.roomText.setText(room.name);
    this.attemptText.setText(this.attempts > 1 ? `Attempt ${this.attempts}` : "");
    if (this.mode === "failing") {
      this.bannerText.setText("The flame went out.").setAlpha(1);
      this.bannerSub.setText("").setAlpha(0);
    } else if (this.mode === "won") {
      this.bannerText.setText("The house is still lit.").setAlpha(1);
      this.bannerSub.setText("Press to walk it again").setAlpha(0.45 + Math.sin(timeSec * 2.2) * 0.35);
      this.promptText.setAlpha(0);
    } else {
      this.bannerText.setAlpha(0);
      this.bannerSub.setAlpha(0);
    }
  }
}
