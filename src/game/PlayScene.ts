import Phaser from "phaser";
import type { GameSdk } from "../kit/sdk";
import {
  BEST_SCORE_KEY,
  C,
  CRAWL_CHEST,
  CRAWL_HEAD,
  CRAWL_MUL,
  CUP_SPEED_MUL,
  EXIT_MARGIN,
  FAIL_BEAT,
  FLAME_MAX,
  FLOOR_Y,
  FONT,
  GAME_H,
  GAME_W,
  GRAVITY,
  JUMP_V0,
  SCORE_TIME_REF,
  SPRINT_MUL,
  STAND_CHEST,
  STAND_HEAD,
  START_OFFSET,
  UI_FONT,
  VAULT_DURATION,
  VAULT_HEIGHT,
  WALK_SPEED,
} from "./constants";
import { drawStaticHouse } from "./drawHouse";
import {
  bakeHouse,
  obstacleId,
  roomAt,
  type BakedRoom,
  type HouseLayout,
  type Obstacle,
} from "./rooms";
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
type FailReason = "flame" | "door";

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

type TouchBtn = {
  id: "cup" | "jump" | "crawl" | "run";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  held: boolean;
  zone: Phaser.GameObjects.Zone;
  gfx: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
};

const BLOCKED_KEYS = new Set([
  "Tab",
  "Escape",
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

const CUP_KEYS = new Set(["Space", "KeyF"]);
const JUMP_KEYS = new Set(["KeyW", "ArrowUp"]);
const CRAWL_KEYS = new Set(["KeyS", "ArrowDown"]);
const SPRINT_KEYS = new Set(["ShiftLeft", "ShiftRight"]);
const GAME_KEYS = new Set([...CUP_KEYS, ...JUMP_KEYS, ...CRAWL_KEYS, ...SPRINT_KEYS, "Enter"]);

function isBlockedKey(code: string): boolean {
  return BLOCKED_KEYS.has(code) || (code.startsWith("F") && code.length <= 4 && code !== "KeyF");
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
  private playerAir = 0;
  private playerVy = 0;
  private flame = FLAME_MAX;
  private attempts = 0;
  private failTimer = 0;
  private failReason: FailReason = "flame";
  private gusts: GustState = {};
  private particles: Particle[] = [];
  private keysHeld = new Set<string>();
  private cupPointer = false;
  private uiBlockPointer = false;
  private leanX = 0;
  private leanY = 0;
  private walkPhase = 0;
  private spawnAcc = 0;
  private elapsed = 0;
  private score = 0;
  private bestScore = 0;
  private obstaclePoints = 0;
  private roomFlamePoints = 0;
  private scoredObstacles = new Set<string>();
  private isFullRun = true;
  private lastRoomIndex = 0;
  private runStartX = 0;
  private winBreakdown = { obstacles: 0, flame: 0, time: 0 };
  private newBest = false;
  private crawling = false;
  private sprinting = false;
  private vaulting = false;
  private vaultT = 0;
  private vaultFromX = 0;
  private vaultToX = 0;
  private vaultObsId: string | null = null;
  private doorTimers: Record<string, number | null> = {};
  private touchBtns: TouchBtn[] = [];
  private hintText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private titleBestText!: Phaser.GameObjects.Text;

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
      .text(GAME_W * 0.5, 150, "Keep Lit", titleStyle)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22)
      .setShadow(0, 10, "#000000", 18, true, true);
    this.taglineText = this.add
      .text(
        GAME_W * 0.5,
        242,
        "Hold to cup the flame. Jump, vault, crawl, or run when the house demands it.",
        {
          fontFamily: FONT,
          fontSize: "22px",
          color: C.textDim,
          align: "center",
          wordWrap: { width: 920 },
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22);
    this.hintText = this.add
      .text(GAME_W * 0.5, 292, "Cup  Space/F   ·   Jump/Vault  W/↑   ·   Crawl  S/↓   ·   Run  Shift", {
        fontFamily: UI_FONT,
        fontSize: "14px",
        color: C.textMute,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22)
      .setAlpha(0.55);
    this.promptText = this.add
      .text(GAME_W * 0.5, 340, "Press to begin", {
        fontFamily: FONT,
        fontSize: "22px",
        color: C.text,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22)
      .setShadow(0, 4, "#000000", 10, true, true);
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
      .text(GAME_W * 0.5, 368, "", {
        fontFamily: FONT,
        fontSize: "20px",
        color: C.textDim,
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5, 0)
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
    this.timerText = this.add
      .text(GAME_W * 0.5, 52, "", {
        fontFamily: UI_FONT,
        fontSize: "18px",
        color: C.textDim,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(22)
      .setAlpha(0);
    this.scoreText = this.add
      .text(48, 64, "", {
        fontFamily: UI_FONT,
        fontSize: "16px",
        color: C.textDim,
      })
      .setScrollFactor(0)
      .setDepth(22)
      .setAlpha(0);
    this.bestText = this.add
      .text(GAME_W - 48, 56, "", {
        fontFamily: UI_FONT,
        fontSize: "15px",
        color: C.textMute,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(22)
      .setAlpha(0);
    this.titleBestText = this.add
      .text(GAME_W * 0.5, 388, "", {
        fontFamily: UI_FONT,
        fontSize: "18px",
        color: C.textDim,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(22)
      .setAlpha(0);

    this.bestScore = this.readBestScore();
    this.buildTouchControls();
    this.bindInput();
    this.setTouchVisible(false);
    this.sdk.loadingStop();
    if (import.meta.env.DEV && this.devRoomIndex() !== null) this.beginRun();
  }

  private buildTouchControls(): void {
    const layout: Array<Omit<TouchBtn, "held" | "zone" | "gfx" | "text">> = [
      { id: "cup", label: "Cup", x: 36, y: GAME_H - 118, w: 168, h: 86 },
      { id: "jump", label: "Jump", x: GAME_W - 372, y: GAME_H - 118, w: 104, h: 86 },
      { id: "crawl", label: "Crawl", x: GAME_W - 252, y: GAME_H - 118, w: 104, h: 86 },
      { id: "run", label: "Run", x: GAME_W - 132, y: GAME_H - 118, w: 100, h: 86 },
    ];
    for (const spec of layout) {
      const gfx = this.add.graphics().setScrollFactor(0).setDepth(24);
      const text = this.add
        .text(spec.x + spec.w * 0.5, spec.y + spec.h * 0.5, spec.label, {
          fontFamily: UI_FONT,
          fontSize: "18px",
          color: C.text,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(25);
      const zone = this.add
        .zone(spec.x + spec.w * 0.5, spec.y + spec.h * 0.5, spec.w, spec.h)
        .setScrollFactor(0)
        .setDepth(26)
        .setInteractive();
      const btn: TouchBtn = { ...spec, held: false, zone, gfx, text };
      zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event?.preventDefault?.();
        this.uiBlockPointer = true;
        btn.held = true;
        if (btn.id === "jump") this.tryJumpOrVault();
        if (this.mode === "title" || this.mode === "won") this.beginRun();
        this.paintTouchBtn(btn);
      });
      const release = () => {
        btn.held = false;
        this.paintTouchBtn(btn);
        if (!this.touchBtns.some((b) => b.held)) this.uiBlockPointer = false;
      };
      zone.on("pointerup", release);
      zone.on("pointerout", release);
      zone.on("pointerupoutside", release);
      this.touchBtns.push(btn);
      this.paintTouchBtn(btn);
    }
  }

  private paintTouchBtn(btn: TouchBtn): void {
    const g = btn.gfx;
    g.clear();
    const active = btn.held;
    g.fillStyle(0x000000, active ? 0.55 : 0.38);
    g.fillRoundedRect(btn.x, btn.y, btn.w, btn.h, 14);
    g.lineStyle(2, active ? C.flame : 0x6a5640, active ? 0.85 : 0.45);
    g.strokeRoundedRect(btn.x + 1, btn.y + 1, btn.w - 2, btn.h - 2, 13);
    btn.text.setAlpha(active ? 1 : 0.82);
  }

  private setTouchVisible(on: boolean): void {
    for (const btn of this.touchBtns) {
      btn.gfx.setVisible(on);
      btn.text.setVisible(on);
      btn.zone.setVisible(on).setActive(on);
      if (!on) btn.held = false;
    }
    if (!on) this.uiBlockPointer = false;
  }

  private touchHeld(id: TouchBtn["id"]): boolean {
    return this.touchBtns.some((b) => b.id === id && b.held);
  }

  private devRoomIndex(): number | null {
    if (!import.meta.env.DEV) return null;
    const raw = new URLSearchParams(window.location.search).get("room");
    const idx = raw === null ? Number.NaN : Number(raw);
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.house.rooms.length) return null;
    return idx;
  }

  private bindInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.uiBlockPointer) return;
      // Cup only when not pressing an on-screen verb button.
      if (this.hitTouchBtn(pointer.x, pointer.y)) return;
      this.cupPointer = true;
      this.onPress();
    });
    this.input.on("pointerup", () => {
      this.cupPointer = false;
    });
    this.input.on("pointerupoutside", () => {
      this.cupPointer = false;
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (isBlockedKey(event.code)) return;
      if (GAME_KEYS.has(event.code) || CUP_KEYS.has(event.code) || JUMP_KEYS.has(event.code)) {
        event.preventDefault();
      }
      if (event.repeat) {
        if (GAME_KEYS.has(event.code)) event.preventDefault();
        return;
      }
      if (GAME_KEYS.has(event.code) || !isBlockedKey(event.code)) {
        // Track cup / crawl / sprint / jump keys; ignore pure modifiers already filtered.
      }
      this.keysHeld.add(event.code);
      if (JUMP_KEYS.has(event.code)) {
        event.preventDefault();
        this.tryJumpOrVault();
      }
      if (
        CUP_KEYS.has(event.code) ||
        JUMP_KEYS.has(event.code) ||
        CRAWL_KEYS.has(event.code) ||
        SPRINT_KEYS.has(event.code) ||
        event.code === "Enter"
      ) {
        event.preventDefault();
        this.onPress();
      }
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => {
      this.keysHeld.delete(event.code);
    });
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      this.keysHeld.clear();
      this.cupPointer = false;
      for (const b of this.touchBtns) b.held = false;
      this.uiBlockPointer = false;
    });
  }

  private hitTouchBtn(x: number, y: number): boolean {
    return this.touchBtns.some(
      (b) => b.zone.visible && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h,
    );
  }

  private wantsCup(): boolean {
    if (this.vaulting) return false;
    if (this.cupPointer) return true;
    if (this.touchHeld("cup")) return true;
    for (const code of this.keysHeld) {
      if (CUP_KEYS.has(code)) return true;
    }
    return false;
  }

  private wantsCrawl(): boolean {
    if (this.vaulting || this.playerAir > 2) return false;
    if (this.touchHeld("crawl")) return true;
    for (const code of this.keysHeld) {
      if (CRAWL_KEYS.has(code)) return true;
    }
    return false;
  }

  private wantsSprint(): boolean {
    if (this.crawling || this.vaulting || this.playerAir > 2) return false;
    if (this.touchHeld("run")) return true;
    for (const code of this.keysHeld) {
      if (SPRINT_KEYS.has(code)) return true;
    }
    return false;
  }

  private onPress(): void {
    if (this.mode === "title" || this.mode === "won") this.beginRun();
  }

  private startLocalX(room: BakedRoom): number {
    const door = room.obstacles?.find(
      (obs): obs is Extract<Obstacle, { kind: "closingDoor" }> => obs.kind === "closingDoor",
    );
    if (door) return Math.max(24, Math.min(START_OFFSET, door.triggerX - 40));
    return Math.min(START_OFFSET, room.width * 0.35);
  }

  private readBestScore(): number {
    try {
      const raw = localStorage.getItem(BEST_SCORE_KEY);
      if (raw == null) return 0;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.floor(n);
    } catch {
      return 0;
    }
  }

  private writeBestScore(value: number): void {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(Math.max(0, Math.floor(value))));
    } catch {
      /* ignore quota / private mode */
    }
  }

  private beginRun(): void {
    this.attempts += 1;
    this.mode = "playing";
    const jump = this.devRoomIndex();
    this.isFullRun = jump === null;
    const startRoom = jump === null ? this.house.rooms[0] : this.house.rooms[jump];
    this.playerX = startRoom.worldX + this.startLocalX(startRoom);
    this.runStartX = this.playerX;
    this.playerAir = 0;
    this.playerVy = 0;
    this.flame = FLAME_MAX;
    this.failTimer = 0;
    this.failReason = "flame";
    this.gusts = {};
    this.particles = [];
    this.leanX = 0;
    this.leanY = 0;
    this.walkPhase = 0;
    this.crawling = false;
    this.sprinting = false;
    this.vaulting = false;
    this.vaultT = 0;
    this.vaultObsId = null;
    this.doorTimers = {};
    this.elapsed = 0;
    this.score = 0;
    this.obstaclePoints = 0;
    this.roomFlamePoints = 0;
    this.scoredObstacles = new Set();
    this.lastRoomIndex = startRoom.index;
    this.winBreakdown = { obstacles: 0, flame: 0, time: 0 };
    this.newBest = false;
    this.bestScore = this.readBestScore();

    this.follower.setPosition(this.playerX, FLOOR_Y - 90);
    this.cameras.main.centerOn(this.playerX + 240, GAME_H * 0.5);
    this.titleText.setAlpha(0);
    this.taglineText.setAlpha(0);
    this.hintText.setAlpha(0);
    this.promptText.setAlpha(0);
    this.titleBestText.setAlpha(0);
    this.bannerText.setAlpha(0);
    this.bannerSub.setAlpha(0);
    this.roomText.setAlpha(1);
    this.attemptText.setAlpha(1);
    this.timerText.setAlpha(1);
    this.scoreText.setAlpha(1);
    this.bestText.setAlpha(1);
    this.setTouchVisible(true);
    this.sdk.gameplayStart();
  }

  private chestY(): number {
    if (this.vaulting) return FLOOR_Y - VAULT_HEIGHT - 20 + this.playerAir;
    if (this.crawling) return FLOOR_Y - CRAWL_CHEST + this.playerAir;
    return FLOOR_Y - STAND_CHEST - this.playerAir;
  }

  private headClearance(): number {
    if (this.crawling) return CRAWL_HEAD;
    if (this.vaulting) return VAULT_HEIGHT + 24;
    return STAND_HEAD + this.playerAir;
  }

  private tryJumpOrVault(): void {
    if (this.mode !== "playing") return;
    if (this.vaulting || this.crawling) return;
    if (this.playerAir > 4) return;
    const vault = this.findVaultInRange();
    if (vault) {
      this.startVault(vault.room, vault.obs);
      return;
    }
    this.playerVy = JUMP_V0;
    this.playerAir = Math.max(this.playerAir, 2);
  }

  private findVaultInRange(): { room: BakedRoom; obs: Extract<Obstacle, { kind: "vault" }> } | null {
    for (const room of this.house.rooms) {
      for (const obs of room.obstacles ?? []) {
        if (obs.kind !== "vault") continue;
        const left = room.worldX + obs.x;
        // Approach from the left within a short window.
        if (this.playerX >= left - 70 && this.playerX <= left + 18) {
          return { room, obs };
        }
        // Already overlapping — still allow vault if not past midpoint.
        if (this.playerX > left && this.playerX < left + obs.w * 0.45) {
          return { room, obs };
        }
      }
    }
    return null;
  }

  private startVault(room: BakedRoom, obs: Extract<Obstacle, { kind: "vault" }>): void {
    this.vaulting = true;
    this.vaultT = 0;
    this.vaultFromX = this.playerX;
    this.vaultToX = room.worldX + obs.x + obs.w + 18;
    this.vaultObsId = obstacleId(room.index, obs);
    this.playerVy = 0;
    this.crawling = false;
    this.sprinting = false;
  }

  private awardObstacle(id: string, points: number): void {
    if (this.scoredObstacles.has(id)) return;
    this.scoredObstacles.add(id);
    this.obstaclePoints += points;
    this.score += points;
  }

  private moveAndCollide(dt: number, held: boolean): void {
    if (this.vaulting) {
      this.vaultT += dt;
      const u = Math.min(1, this.vaultT / VAULT_DURATION);
      const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      this.playerX = Phaser.Math.Linear(this.vaultFromX, this.vaultToX, ease);
      this.playerAir = Math.sin(u * Math.PI) * (VAULT_HEIGHT + 18);
      if (u >= 1) {
        this.vaulting = false;
        this.playerAir = 0;
        this.playerVy = 0;
        this.playerX = this.vaultToX;
        if (this.vaultObsId) {
          this.awardObstacle(this.vaultObsId, 150);
          this.vaultObsId = null;
        }
      }
      this.walkPhase += 10 * dt;
      return;
    }

    this.crawling = this.wantsCrawl();
    this.sprinting = !this.crawling && this.wantsSprint();

    let speedMul = 1;
    if (this.crawling) speedMul = CRAWL_MUL;
    else if (this.sprinting) speedMul = SPRINT_MUL;
    else if (held) speedMul = CUP_SPEED_MUL;

    const speed = WALK_SPEED * speedMul;
    let nextX = this.playerX + speed * dt;

    // Vertical: jump arc
    if (this.playerAir > 0 || this.playerVy > 0) {
      this.playerVy -= GRAVITY * dt;
      this.playerAir += this.playerVy * dt;
      if (this.playerAir <= 0) {
        this.playerAir = 0;
        this.playerVy = 0;
      }
    }

    nextX = this.resolveBlockers(this.playerX, nextX);
    this.playerX = Math.min(this.house.width - EXIT_MARGIN + 8, nextX);
    this.walkPhase += speed * dt * (this.sprinting ? 0.11 : this.crawling ? 0.05 : 0.085);

    // Gap fall while not airborne enough
    this.checkGapFail();
  }

  private resolveBlockers(fromX: number, toX: number): number {
    let x = toX;
    for (const room of this.house.rooms) {
      for (const obs of room.obstacles ?? []) {
        const left = room.worldX + obs.x;

        if (obs.kind === "vault") {
          // Solid unless vaulting (handled elsewhere). Block walking into it.
          if (fromX <= left + 2 && x > left - 4 && this.playerAir < obs.h - 8) {
            x = Math.min(x, left - 2);
          }
        } else if (obs.kind === "crawl") {
          // Standing cannot pass under; crawling can if head clears.
          const need = this.headClearance();
          if (need > obs.clearance - 2) {
            if (fromX <= left + 2 && x > left - 4) {
              x = Math.min(x, left - 2);
            }
          }
        } else if (obs.kind === "closingDoor") {
          const key = `${room.index}:door`;
          const started = this.doorTimers[key];
          const local = fromX - room.worldX;
          if (started == null && local >= obs.triggerX) {
            this.doorTimers[key] = this.time.now / 1000;
          }
          const open = this.doorOpenAmount(room, obs);
          const gapRight = left + obs.openW * open;
          // Seal: treat as solid wall when mostly closed.
          if (open <= 0.12) {
            if (fromX < left + 8 && x >= left - 2) {
              // Door slammed — door fail if still approaching or inside frame.
              this.failRun("door");
              return fromX;
            }
          } else if (fromX < left + 4 && x > left - 2) {
            // Passage shrinks; block if body won't fit (player width ~36).
            const passage = gapRight - left;
            if (passage < 40) {
              x = Math.min(x, left - 2);
            }
          }
        }
      }
    }
    return x;
  }

  private doorOpenAmount(
    room: BakedRoom,
    obs: Extract<Obstacle, { kind: "closingDoor" }>,
  ): number {
    const key = `${room.index}:door`;
    const started = this.doorTimers[key];
    if (started == null) return 1;
    const elapsed = this.time.now / 1000 - started;
    return Phaser.Math.Clamp(1 - elapsed / obs.closeTime, 0, 1);
  }

  private checkGapFail(): void {
    if (this.mode !== "playing") return;
    for (const room of this.house.rooms) {
      for (const obs of room.obstacles ?? []) {
        if (obs.kind !== "gap") continue;
        const left = room.worldX + obs.x;
        const right = left + obs.w;
        if (this.playerX > left + 8 && this.playerX < right - 8 && this.playerAir < 18) {
          // Fell into the gap — snuffs the flame.
          this.failRun("flame");
          return;
        }
      }
    }
  }

  private updateDoorsAndElapsed(dt: number): void {
    this.elapsed += dt;
    // Closing door seal while player is in the doorway.
    for (const room of this.house.rooms) {
      for (const obs of room.obstacles ?? []) {
        if (obs.kind !== "closingDoor") continue;
        const open = this.doorOpenAmount(room, obs);
        const left = room.worldX + obs.x;
        const right = left + obs.openW;
        if (open <= 0.02 && this.playerX >= left - 4 && this.playerX <= right + 10) {
          this.failRun("door");
          return;
        }
      }
    }
  }

  private updateScoreProgress(): void {
    if (this.mode !== "playing") return;
    const room = roomAt(this.house.rooms, this.playerX);
    if (room.index > this.lastRoomIndex) {
      // Left previous room(s) — flame bonus per room exit with healthy flame.
      for (let i = this.lastRoomIndex; i < room.index; i++) {
        if (this.flame >= 80) {
          this.roomFlamePoints += 50;
          this.score += 50;
        }
      }
      this.lastRoomIndex = room.index;
    }

    for (const r of this.house.rooms) {
      for (const obs of r.obstacles ?? []) {
        const id = obstacleId(r.index, obs);
        if (this.scoredObstacles.has(id)) continue;
        const left = r.worldX + obs.x;
        // DEV ?room= starts mid-house: don't credit obstacles already behind the spawn.
        if (this.runStartX >= left - 8) continue;
        if (obs.kind === "gap") {
          const right = left + obs.w;
          if (this.playerX >= right - 2) {
            this.awardObstacle(id, 200);
          }
        } else if (obs.kind === "crawl") {
          const right = left + obs.w;
          // Emerged past the far side (must have been able to pass → crawling).
          if (this.playerX >= right + 4) {
            this.awardObstacle(id, 150);
          }
        } else if (obs.kind === "closingDoor") {
          const passX = left + obs.openW;
          if (this.playerX >= passX + 6) {
            this.awardObstacle(id, 250);
          }
        }
      }
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    const timeSec = this.time.now / 1000;
    const held = this.wantsCup();

    if (this.mode === "playing") {
      updateGusts(this.house.rooms, this.playerX, timeSec, this.gusts);
      this.moveAndCollide(dt, held);
      if (this.mode !== "playing") {
        // fail may have triggered inside collide
      } else {
        const wind = sampleWind(
          this.house.rooms,
          this.playerX,
          timeSec,
          this.gusts,
          this.chestY(),
        );
        this.flame = Phaser.Math.Clamp(
          this.flame +
            flameDelta(
              {
                cupped: held,
                sprinting: this.sprinting,
                crawling: this.crawling,
                airborne: this.playerAir > 6,
                vaulting: this.vaulting,
              },
              wind,
              dt,
            ),
          0,
          FLAME_MAX,
        );
        const leanMul = held && !this.sprinting && !this.vaulting ? 0.32 : 1;
        this.leanX += (wind.dx * wind.strength * leanMul - this.leanX) * Math.min(1, dt * 7);
        this.leanY += (wind.dy * wind.strength * leanMul - this.leanY) * Math.min(1, dt * 7);
        this.spawnFx(dt, timeSec, wind, held);
        this.updateDoorsAndElapsed(dt);
        this.updateScoreProgress();
        if (this.mode === "playing") {
          if (this.flame <= 0) this.failRun("flame");
          else if (this.playerX >= this.house.width - EXIT_MARGIN) this.winRun();
        }
      }
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
      this.promptText.setAlpha(0.82 + Math.sin(timeSec * 2.2) * 0.18);
    } else if (this.mode === "won") {
      this.leanX += (0 - this.leanX) * dt * 3;
      this.leanY += (0 - this.leanY) * dt * 3;
      this.promptText.setAlpha(0.45 + Math.sin(timeSec * 2.2) * 0.35);
    }

    this.follower.setPosition(this.playerX, FLOOR_Y - 90 - this.playerAir);
    this.drawDynamics(timeSec, held);
    this.drawGlow(held);
    this.drawPerson(timeSec, held);
    this.drawParticles(dt);
    this.drawVignette();
    this.drawHud();
    this.refreshCopy(timeSec);
  }

  private failRun(reason: FailReason = "flame"): void {
    if (this.mode !== "playing") return;
    this.mode = "failing";
    this.failReason = reason;
    this.failTimer = FAIL_BEAT;
    this.flame = 0;
    this.vaulting = false;
    this.sdk.gameplayStop();
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.push({
        x: this.playerX + 18,
        y: FLOOR_Y - 118 - this.playerAir,
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
    // Final room exit flame bonus if still in last room with healthy flame.
    if (this.flame >= 80) {
      this.roomFlamePoints += 50;
      this.score += 50;
    }
    const flameBonus = Math.floor(this.flame) * 10;
    const timeBonus = Math.max(0, Math.floor((SCORE_TIME_REF - this.elapsed) * 8));
    this.winBreakdown = {
      obstacles: this.obstaclePoints,
      flame: this.roomFlamePoints + flameBonus,
      time: timeBonus,
    };
    this.score = this.obstaclePoints + this.winBreakdown.flame + timeBonus;
    this.newBest = false;
    if (this.isFullRun && this.score > this.bestScore) {
      this.bestScore = this.score;
      this.writeBestScore(this.bestScore);
      this.newBest = true;
    }
    this.roomText.setAlpha(1);
    this.promptText.setText("Press to walk it again").setAlpha(1);
    this.setTouchVisible(false);
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
            y: FLOOR_Y - 124 - low * 10 - this.playerAir,
            vx: this.leanX * 30 + (Math.random() - 0.5) * 12,
            vy: -20 - Math.random() * 30,
            life: 0.3 + Math.random() * 0.25,
            max: 0.5,
            size: 2 + Math.random() * 2,
            color: held ? C.flameMid : C.flame,
            kind: "ember",
          });
        }
        if (wind.rain > 0.2 && Math.random() < 0.5) {
          const room = roomAt(this.house.rooms, this.playerX);
          for (const hazard of room.hazards) {
            if (hazard.kind !== "rain") continue;
            this.particles.push({
              x: room.worldX + hazard.x + Math.random() * hazard.w,
              y: 120 + Math.random() * 40,
              vx: 10 + Math.random() * 20,
              vy: 220 + Math.random() * 160,
              life: 0.9,
              max: 0.9,
              size: 2,
              color: 0x8ab0c0,
              kind: "drip",
            });
          }
        }
      }
    }
  }

  private spawnZoneParticles(timeSec: number): void {
    const cam = this.cameras.main.worldView;
    for (const room of this.house.rooms) {
      if (room.worldX + room.width < cam.x - 40 || room.worldX > cam.right + 40) continue;
      for (const hazard of room.hazards) {
        if (hazard.kind === "draft" || hazard.kind === "chimney") {
          if (Math.random() > 0.55) continue;
          const x = room.worldX + hazard.x + Math.random() * hazard.w;
          this.particles.push({
            x,
            y: FLOOR_Y - 40 - Math.random() * 220,
            vx: hazard.dir.x * (40 + Math.random() * 60),
            vy: hazard.dir.y * (30 + Math.random() * 40),
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
        y: FLOOR_Y - 110 - this.playerAir,
        vx: (Math.random() - 0.5) * 30,
        vy: -10 - Math.random() * 40,
        life: 0.4,
        max: 0.4,
        size: 4 + Math.random() * 6,
        color: 0x6a6058,
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

  private drawRoomDynamics(
    g: Phaser.GameObjects.Graphics,
    room: BakedRoom,
    timeSec: number,
    _held: boolean,
  ): void {
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
      const pulse =
        room.hazards[0]?.kind === "periodic" ? periodicActive(room.hazards[0], timeSec) : 0.4;
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
      for (const obs of room.obstacles ?? []) {
        if (obs.kind !== "closingDoor") continue;
        const open = this.doorOpenAmount(room, obs);
        const close = 1 - open;
        // Sliding leaf from the right jamb.
        const leafW = obs.openW * close;
        const hinge = x + obs.x + obs.openW;
        g.fillStyle(C.woodMid, 1);
        g.fillRect(hinge - leafW, 192, leafW, FLOOR_Y - 192);
        g.fillStyle(C.woodDark, 1);
        g.fillRect(hinge - leafW, 192, 6, FLOOR_Y - 192);
        g.fillStyle(C.trim, 1);
        g.fillCircle(hinge - leafW + 14, 400, 4);
        if (close > 0.15) {
          g.fillStyle(0xc45a2a, 0.15 + close * 0.25);
          g.fillRect(x + obs.x - 6, 180, obs.openW + 12, 8);
        }
      }
      const hazard = room.hazards[0];
      if (hazard?.kind === "approachGust") {
        const env = gustEnvelope(hazard, this.gusts[hazard.id]?.openedAt ?? null, timeSec);
        // Soft curtain stir near the counters — door slam is the closingDoor leaf above.
        if (env.wind > 0.1) {
          g.fillStyle(0xd0c0a8, 0.08 * env.wind);
          g.fillEllipse(x + hazard.gustX + 40, 320, 80, 120);
        }
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

  private drawStormGlass(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    timeSec: number,
  ): void {
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
    const walking = this.mode === "playing" && !this.vaulting;
    const sprint = this.sprinting && walking;
    const crawl = this.crawling && this.mode === "playing";
    const air = this.playerAir > 6 || this.vaulting;
    const step = walking ? Math.sin(this.walkPhase) : 0;
    const bob = walking
      ? Math.cos(this.walkPhase * 2) * (held ? 1.2 : sprint ? 3.2 : 2.2)
      : Math.sin(timeSec * 2) * 0.6;
    const x = this.playerX;
    const feet = FLOOR_Y + bob - this.playerAir;
    const cup = held && this.mode === "playing" && !this.vaulting;

    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(x + 4, FLOOR_Y + 6, crawl ? 58 : 50, crawl ? 10 : 12);

    if (this.vaulting) {
      // Hands leave the flame; body leans over the sofa.
      const lean = 18;
      g.fillStyle(C.pants, 1);
      g.fillRoundedRect(x - 20, feet - 36, 40, 16, 6);
      g.fillRoundedRect(x - 28, feet - 28, 18, 22, 5);
      g.fillRoundedRect(x + 10, feet - 28, 18, 22, 5);
      g.fillStyle(C.coat, 1);
      g.fillRoundedRect(x - 22 + lean * 0.2, feet - 70, 48, 40, 10);
      g.fillStyle(C.skin, 1);
      g.fillCircle(x + 18, feet - 82, 14);
      g.fillStyle(C.hair, 1);
      g.fillEllipse(x + 16, feet - 90, 26, 16);
      // Arms out, not cupping
      g.fillStyle(C.coatLite, 1);
      g.fillRoundedRect(x - 34, feet - 64, 22, 10, 4);
      g.fillRoundedRect(x + 28, feet - 60, 22, 10, 4);
      this.drawFlame(g, x + 10 + this.leanX * 10, feet - 58 + this.leanY * 8, false, timeSec);
      return;
    }

    if (crawl) {
      const legSpan = walking ? step * 10 : 0;
      g.fillStyle(C.pants, 1);
      g.fillRoundedRect(x - 22 + legSpan, feet - 28, 28, 14, 5);
      g.fillRoundedRect(x + 2 - legSpan, feet - 22, 26, 14, 5);
      g.fillStyle(0x12100e, 1);
      g.fillRoundedRect(x - 24 + legSpan, feet - 12, 18, 10, 3);
      g.fillRoundedRect(x + 8 - legSpan, feet - 10, 18, 10, 3);
      g.fillStyle(C.coat, 1);
      g.fillRoundedRect(x - 20, feet - 52, 44, 28, 8);
      const headY = feet - 58;
      g.fillStyle(C.skin, 1);
      g.fillCircle(x + 16, headY, 13);
      g.fillStyle(C.hair, 1);
      g.fillEllipse(x + 14, headY - 6, 24, 14);
      const flameX = x + 28 + this.leanX * 8;
      const flameY = feet - 44 + this.leanY * 8;
      if (cup) {
        g.fillStyle(C.coatLite, 1);
        g.fillRoundedRect(x + 8, flameY - 2, 16, 16, 6);
        g.fillRoundedRect(x + 26, flameY - 2, 16, 16, 6);
      }
      this.drawFlame(g, flameX, flameY, cup, timeSec);
      return;
    }

    const stride = sprint ? 22 : cup ? 9 : 16;
    const legSpan = walking ? step * stride : air ? 8 : 0;
    const legH = air ? 48 : 62;
    g.fillStyle(C.pants, 1);
    g.fillRoundedRect(x - 14 + legSpan, feet - legH, 13, legH, 5);
    g.fillRoundedRect(x + 2 - legSpan, feet - legH, 13, legH, 5);
    g.fillStyle(0x12100e, 1);
    g.fillRoundedRect(x - 16 + legSpan, feet - 12, 16, 12, 3);
    g.fillRoundedRect(x + 2 - legSpan, feet - 12, 16, 12, 3);

    const torsoH = cup ? 58 : sprint ? 60 : 64;
    const torsoY = feet - legH - (air ? 4 : 0) - torsoH + (air ? 10 : 0);
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

  private drawFlame(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    cupped: boolean,
    timeSec: number,
  ): void {
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
    const amp = 1.1 - t * 1.4 + Math.hypot(this.leanX, this.leanY) * 0.8;
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
    const y = FLOOR_Y - 118 + this.leanY * 12 - this.playerAir;
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

  private formatTime(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  private refreshCopy(timeSec: number): void {
    if (this.mode === "title") {
      this.titleText.setAlpha(1);
      this.taglineText.setAlpha(1);
      this.hintText.setAlpha(0.55);
      this.promptText.setAlpha(0.88 + Math.sin(timeSec * 2.2) * 0.12);
      this.timerText.setAlpha(0);
      this.scoreText.setAlpha(0);
      this.bestText.setAlpha(0);
      if (this.bestScore > 0) {
        this.titleBestText.setText(`Best  ${this.bestScore}`).setAlpha(0.85);
      } else {
        this.titleBestText.setText("").setAlpha(0);
      }
      return;
    }
    this.titleBestText.setAlpha(0);
    const room = roomAt(this.house.rooms, this.playerX);
    this.roomText.setText(room.name);
    this.attemptText.setText(this.attempts > 1 ? `Attempt ${this.attempts}` : "");
    if (this.mode === "playing" || this.mode === "failing" || this.mode === "won") {
      this.timerText.setText(this.formatTime(this.elapsed)).setColor(C.textDim).setAlpha(1);
      this.scoreText.setText(`Score  ${this.score}`).setAlpha(1);
      this.bestText.setText(this.bestScore > 0 ? `Best  ${this.bestScore}` : "Best  —").setAlpha(1);
    } else {
      this.timerText.setAlpha(0);
      this.scoreText.setAlpha(0);
      this.bestText.setAlpha(0);
    }
    if (this.mode === "failing") {
      const msg =
        this.failReason === "door" ? "The door closed." : "The flame went out.";
      this.bannerText.setText(msg).setAlpha(1);
      this.bannerSub.setText(`Score  ${this.score}`).setAlpha(0.9);
    } else if (this.mode === "won") {
      this.bannerText.setText("The house is still lit.").setAlpha(1);
      const b = this.winBreakdown;
      const lines = [
        `Obstacles  ${b.obstacles}    Flame  ${b.flame}    Time  ${b.time}`,
        `Score  ${this.score}` + (this.newBest ? "    New best" : ""),
        "Press to walk it again",
      ];
      this.bannerSub
        .setText(lines.join("\n"))
        .setAlpha(0.55 + Math.sin(timeSec * 2.2) * 0.25);
      this.promptText.setAlpha(0);
    } else {
      this.bannerText.setAlpha(0);
      this.bannerSub.setAlpha(0);
    }
  }
}
