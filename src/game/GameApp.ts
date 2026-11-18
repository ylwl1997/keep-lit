import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { GameSdk } from "../kit/sdk";
import {
  BEST_SCORE_KEY,
  C,
  CRAWL_CHEST,
  CRAWL_HEAD,
  CRAWL_MUL,
  CUP_SPEED_MUL,
  DOOR_SQUEEZE,
  EXIT_MARGIN,
  FAIL_BEAT,
  FLAME_MAX,
  FLOOR_Y,
  GAME_H,
  GAME_W,
  GRAVITY,
  HINT_CRAWL_KEY,
  HINT_JUMP_KEY,
  INPUT_BUFFER,
  JUMP_V0,
  SCORE_TIME_REF,
  SPRINT_MUL,
  STAND_CHEST,
  STAND_HEAD,
  START_OFFSET,
  VAULT_DURATION,
  VAULT_HEIGHT,
  WALK_SPEED,
} from "./constants";
import { Character, type CharacterPose } from "./character";
import { House } from "./house";
import { Hud, type FailReason } from "./hud";
import { wu } from "./scale";
import { createGameTextures } from "./textures";
import {
  bakeHouse,
  obstacleId,
  roomAt,
  type BakedRoom,
  type HouseLayout,
  type Obstacle,
} from "./rooms";
import {
  flameDelta,
  sampleWind,
  updateGusts,
  type GustState,
} from "./wind";

type Mode = "title" | "playing" | "failing" | "won";

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

export class GameApp {
  private readonly sdk: GameSdk;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly house: House;
  private readonly character: Character;
  private readonly hud: Hud;
  private readonly layout: HouseLayout;
  private readonly moon: THREE.DirectionalLight;
  private readonly windowSpots: THREE.SpotLight[] = [];
  private readonly contactShadow: THREE.Mesh;

  private mode: Mode = "title";
  private playerX = 0;
  private playerAir = 0;
  private playerVy = 0;
  private flame = FLAME_MAX;
  private attempts = 0;
  private failTimer = 0;
  private gusts: GustState = {};
  private keysHeld = new Set<string>();
  private cupPointer = false;
  private cupButton = false;
  private crawlButton = false;
  private runButton = false;
  private jumpFlash = 0;
  private leanX = 0;
  private leanY = 0;
  private walkPhase = 0;
  private elapsed = 0;
  private timeSec = 0;
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
  private lastTs: number | null = null;
  /** Presses that arrived while still airborne, consumed after landing. */
  private jumpBuffer = 0;
  private crawlBuffer = 0;
  private jumpHintDone = false;
  private crawlHintDone = false;

  constructor(container: HTMLElement, canvas: HTMLCanvasElement, sdk: GameSdk) {
    this.sdk = sdk;
    this.layout = bakeHouse();
    this.playerX = this.layout.rooms[0].worldX + START_OFFSET;
    this.bestScore = this.readBestScore();
    this.jumpHintDone = this.readFlag(HINT_JUMP_KEY);
    this.crawlHintDone = this.readFlag(HINT_CRAWL_KEY);

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch (err) {
      throw new Error(`WebGL failed to start. ${err instanceof Error ? err.message : String(err)}`);
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(GAME_W, GAME_H, false);
    this.renderer.setClearColor(C.fog, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(34, GAME_W / GAME_H, 0.1, 80);
    this.scene.fog = new THREE.FogExp2(C.fog, 0.01);
    this.scene.background = new THREE.Color(C.fog);

    const ambient = new THREE.AmbientLight(C.ambient, 0.18);
    this.scene.add(ambient);

    this.moon = new THREE.DirectionalLight(C.moonFill, 0.2);
    this.moon.position.set(-4, 6, 3);
    this.scene.add(this.moon);

    for (let i = 0; i < 3; i++) {
      const spot = new THREE.SpotLight(C.moonFill, 0.18, 10, 0.55, 0.6, 1.4);
      spot.position.set(0, 3.2, -3.2);
      spot.target.position.set(0, 1.2, 0);
      this.scene.add(spot, spot.target);
      this.windowSpots.push(spot);
    }

    const textures = createGameTextures();
    this.house = new House(this.layout, textures);
    this.scene.add(this.house.group);

    this.character = new Character(textures);
    this.scene.add(this.character.group);

    this.contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.7),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.01;
    this.scene.add(this.contactShadow);

    const hudRoot = document.getElementById("hud");
    if (!(hudRoot instanceof HTMLElement)) throw new Error("Missing #hud");
    this.hud = new Hud(hudRoot, {
      onJump: () => this.armJump(),
      onCrawlPress: () => this.armCrawl(),
      onCupChange: (held) => {
        this.cupButton = held;
      },
      onCrawlChange: (held) => {
        this.crawlButton = held;
      },
      onRunChange: (held) => {
        this.runButton = held;
      },
      onStart: () => this.onPress(),
    });

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(GAME_W, GAME_H), 0.35, 0.2, 0.85);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setSize(GAME_W, GAME_H);

    this.bindInput(container, canvas);
    this.hud.showTitle(this.bestScore);
    this.placeCharacter();
    this.updateCamera();
    this.assignWindowLights();

    this.sdk.loadingStop();
    if (import.meta.env.DEV && this.devRoomIndex() !== null) this.beginRun();
    this.renderer.setAnimationLoop(this.frame);
  }

  private frame = (ts: number): void => {
    const t = ts / 1000;
    const dt = Math.min(0.05, this.lastTs == null ? 1 / 60 : t - this.lastTs);
    this.lastTs = t;
    this.timeSec += dt;
    this.tick(dt);
    this.composer.render();
  };

  private tick(dt: number): void {
    const held = this.wantsCup();

    if (this.mode === "playing") {
      updateGusts(this.layout.rooms, this.playerX, this.timeSec, this.gusts);
      this.moveAndCollide(dt, held);
      if (this.mode === "playing") {
        const wind = sampleWind(
          this.layout.rooms,
          this.playerX,
          this.timeSec,
          this.gusts,
          this.chestY(),
        );
        this.flame = clamp(
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
        this.updateDoorsAndElapsed(dt);
        this.updateScoreProgress();
        if (this.mode === "playing") {
          if (this.flame <= 0) this.failRun("flame");
          else if (this.playerX >= this.layout.width - EXIT_MARGIN) this.winRun();
        }
      }
    } else if (this.mode === "failing") {
      this.failTimer -= dt;
      this.flame = 0;
      this.leanX *= 1 - dt * 4;
      this.leanY *= 1 - dt * 4;
      this.character.updateSmoke(dt, this.timeSec);
      if (this.failTimer <= 0) this.beginRun();
    } else if (this.mode === "title") {
      this.leanX += (0.08 - this.leanX) * dt * 3;
      this.leanY += (0 - this.leanY) * dt * 3;
    } else {
      this.leanX += (0 - this.leanX) * dt * 3;
      this.leanY += (0 - this.leanY) * dt * 3;
    }

    if (this.jumpFlash > 0) this.jumpFlash = Math.max(0, this.jumpFlash - dt);

    this.house.update(this.timeSec, (key, closeTime) => this.doorOpenByKey(key, closeTime));
    this.placeCharacter();
    this.updateCamera();
    this.assignWindowLights();
    this.refreshHud(held);
  }

  private placeCharacter(): void {
    const y = wu(this.playerAir);
    this.character.group.position.set(wu(this.playerX), y, 0);
    const pose = this.currentPose();
    this.character.setPose(pose, this.walkPhase, this.leanX, this.leanY, this.timeSec);
    const lit = this.mode !== "failing" && this.flame > 0;
    this.character.setLit(lit, this.flame / FLAME_MAX);
    this.contactShadow.position.set(wu(this.playerX), 0.012, 0);
    const shadowMat = this.contactShadow.material;
    if (shadowMat instanceof THREE.MeshBasicMaterial) {
      shadowMat.opacity = this.playerAir > 8 ? 0.16 : 0.38;
    }
    this.contactShadow.scale.set(this.crawling ? 1.6 : 1, 1, this.crawling ? 0.7 : 1);
  }

  private currentPose(): CharacterPose {
    if (this.mode === "failing") return this.crawling ? "crawl" : "stand";
    if (this.vaulting) return "vault";
    if (this.playerAir > 8) return "jump";
    if (this.crawling) return "crawl";
    if (this.sprinting) return "run";
    if (this.wantsCup()) return "cup";
    return "stand";
  }

  private updateCamera(): void {
    const px = wu(this.playerX);
    const py = wu(this.playerAir);
    const yaw = THREE.MathUtils.degToRad(10);
    const dist = 7.2;
    this.camera.position.set(px - Math.sin(yaw) * dist, py + 1.15, Math.cos(yaw) * dist);
    this.camera.lookAt(px + 0.45, py + 0.55, 0);
  }

  private assignWindowLights(): void {
    const px = wu(this.playerX);
    const sorted = [...this.house.windows].sort((a, b) => Math.abs(a.x - px) - Math.abs(b.x - px));
    for (let i = 0; i < this.windowSpots.length; i++) {
      const spot = this.windowSpots[i];
      const win = sorted[i];
      if (!win) {
        spot.intensity = 0;
        continue;
      }
      spot.position.set(win.x - 0.2, win.y + 0.4, win.z - 0.8);
      spot.target.position.set(win.x, 1.0, 0.2);
      spot.target.updateMatrixWorld();
      const fall = 1 - Math.min(1, Math.abs(win.x - px) / 14);
      spot.intensity = 0.18 * fall;
    }
  }

  private refreshHud(held: boolean): void {
    const room = roomAt(this.layout.rooms, this.playerX);
    if (this.mode === "playing" || this.mode === "failing" || this.mode === "won") {
      this.hud.updateRun({
        room: room.name,
        score: this.score,
        best: this.bestScore,
        attempts: this.attempts,
        elapsed: this.elapsed,
        flame: this.flame,
        flameMax: FLAME_MAX,
      });
    }
    this.hud.setHeldVisuals({
      cup: held,
      jump: this.jumpFlash > 0,
      crawl: this.crawling && this.mode === "playing",
      run: this.sprinting && this.mode === "playing",
    });
    this.updateHints();
  }

  private bindInput(container: HTMLElement, canvas: HTMLCanvasElement): void {
    const down = (ev: PointerEvent) => {
      if (this.hud.isOnButton(ev.target)) return;
      this.cupPointer = true;
      this.onPress();
    };
    const up = () => {
      this.cupPointer = false;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", up);
    container.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("keydown", (event) => {
      if (isBlockedKey(event.code)) return;
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      if (event.repeat) return;
      this.keysHeld.add(event.code);
      if (JUMP_KEYS.has(event.code)) this.armJump();
      if (CRAWL_KEYS.has(event.code)) this.armCrawl();
      if (
        CUP_KEYS.has(event.code) ||
        JUMP_KEYS.has(event.code) ||
        CRAWL_KEYS.has(event.code) ||
        SPRINT_KEYS.has(event.code) ||
        event.code === "Enter"
      ) {
        this.onPress();
      }
    });
    window.addEventListener("keyup", (event) => {
      this.keysHeld.delete(event.code);
    });
    window.addEventListener("blur", () => {
      this.keysHeld.clear();
      this.cupPointer = false;
      this.cupButton = false;
      this.crawlButton = false;
      this.runButton = false;
    });
  }

  private devRoomIndex(): number | null {
    // Production builds replace import.meta.env.DEV with false and drop this path.
    if (!import.meta.env.DEV) return null;
    const raw = new URLSearchParams(window.location.search).get("room");
    const idx = raw === null ? Number.NaN : Number(raw);
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.layout.rooms.length) return null;
    return idx;
  }

  private wantsCup(): boolean {
    if (this.vaulting) return false;
    if (this.cupPointer || this.cupButton) return true;
    for (const code of this.keysHeld) {
      if (CUP_KEYS.has(code)) return true;
    }
    return false;
  }

  private wantsCrawlHeld(): boolean {
    if (this.vaulting) return false;
    if (this.crawlButton) return true;
    for (const code of this.keysHeld) {
      if (CRAWL_KEYS.has(code)) return true;
    }
    return false;
  }

  private wantsSprintHeld(): boolean {
    if (this.crawling || this.vaulting) return false;
    if (this.runButton) return true;
    for (const code of this.keysHeld) {
      if (SPRINT_KEYS.has(code)) return true;
    }
    return false;
  }

  private armJump(): void {
    this.jumpBuffer = INPUT_BUFFER;
    this.jumpFlash = 0.12;
  }

  private armCrawl(): void {
    this.crawlBuffer = INPUT_BUFFER;
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
    const startRoom = jump === null ? this.layout.rooms[0] : this.layout.rooms[jump];
    this.playerX = startRoom.worldX + this.startLocalX(startRoom);
    this.runStartX = this.playerX;
    this.playerAir = 0;
    this.playerVy = 0;
    this.flame = FLAME_MAX;
    this.failTimer = 0;
    this.gusts = {};
    this.leanX = 0;
    this.leanY = 0;
    this.walkPhase = 0;
    this.crawling = false;
    this.sprinting = false;
    this.vaulting = false;
    this.vaultT = 0;
    this.vaultObsId = null;
    this.doorTimers = {};
    this.jumpBuffer = 0;
    this.crawlBuffer = 0;
    this.elapsed = 0;
    this.score = 0;
    this.obstaclePoints = 0;
    this.roomFlamePoints = 0;
    this.scoredObstacles = new Set();
    this.lastRoomIndex = startRoom.index;
    this.winBreakdown = { obstacles: 0, flame: 0, time: 0 };
    this.newBest = false;
    this.bestScore = this.readBestScore();
    this.hud.showPlaying();
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

  /** Called only after vertical integration, so a landing is already resolved. */
  private consumeJump(): void {
    if (this.mode !== "playing" || this.vaulting) return;
    if (this.playerAir > 4) return;
    this.jumpFlash = 0.12;
    const vault = this.findVaultInRange();
    if (vault) {
      this.startVault(vault.room, vault.obs);
      return;
    }
    this.playerVy = JUMP_V0;
    this.playerAir = Math.max(this.playerAir, 2);
  }

  private findVaultInRange(): { room: BakedRoom; obs: Extract<Obstacle, { kind: "vault" }> } | null {
    for (const room of this.layout.rooms) {
      for (const obs of room.obstacles ?? []) {
        if (obs.kind !== "vault") continue;
        const left = room.worldX + obs.x;
        if (this.playerX >= left - 70 && this.playerX <= left + 18) {
          return { room, obs };
        }
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

  private integrateVertical(dt: number): void {
    if (this.playerAir <= 0 && this.playerVy <= 0) return;
    this.playerVy -= GRAVITY * dt;
    this.playerAir += this.playerVy * dt;
    if (this.playerAir <= 0) {
      this.playerAir = 0;
      this.playerVy = 0;
    }
  }

  private moveAndCollide(dt: number, held: boolean): void {
    if (this.vaulting) {
      this.vaultT += dt;
      const u = Math.min(1, this.vaultT / VAULT_DURATION);
      const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      this.playerX = this.vaultFromX + (this.vaultToX - this.vaultFromX) * ease;
      this.playerAir = Math.sin(u * Math.PI) * (VAULT_HEIGHT + 18);
      if (u >= 1) {
        this.vaulting = false;
        this.playerAir = 0;
        this.playerVy = 0;
        this.playerX = this.vaultToX;
        if (this.vaultObsId) {
          this.awardObstacle(this.vaultObsId, 150);
          this.finishHint("jump");
          this.vaultObsId = null;
        }
      }
      this.walkPhase += 10 * dt;
      return;
    }

    // Land before consuming jump/crawl so a press in the last moments of a hop registers.
    this.integrateVertical(dt);
    if (this.mode !== "playing") return;

    const grounded = this.playerAir <= 0 && this.playerVy <= 0;
    if (grounded && this.jumpBuffer > 0 && !this.wantsCrawlHeld()) {
      this.jumpBuffer = 0;
      this.crawling = false;
      this.consumeJump();
    }
    if (this.vaulting) return;

    const groundedNow = this.playerAir <= 0 && this.playerVy <= 0;
    this.crawling = groundedNow && (this.wantsCrawlHeld() || this.crawlBuffer > 0);
    this.sprinting = groundedNow && !this.crawling && this.wantsSprintHeld();

    let speedMul = 1;
    if (this.crawling) speedMul = CRAWL_MUL;
    else if (this.sprinting) speedMul = SPRINT_MUL;
    else if (held) speedMul = CUP_SPEED_MUL;

    const speed = WALK_SPEED * speedMul;
    let nextX = this.playerX + speed * dt;
    nextX = this.resolveBlockers(this.playerX, nextX);
    this.playerX = Math.min(this.layout.width - EXIT_MARGIN + 8, nextX);
    this.walkPhase += speed * dt * (this.sprinting ? 0.11 : this.crawling ? 0.05 : 0.085);
    this.checkGapFail();

    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (!this.wantsCrawlHeld()) this.crawlBuffer = Math.max(0, this.crawlBuffer - dt);
  }

  private resolveBlockers(fromX: number, toX: number): number {
    let x = toX;
    for (const room of this.layout.rooms) {
      for (const obs of room.obstacles ?? []) {
        const left = room.worldX + obs.x;

        if (obs.kind === "vault") {
          if (fromX <= left + 2 && x > left - 4 && this.playerAir < obs.h - 8) {
            x = Math.min(x, left - 2);
          }
        } else if (obs.kind === "crawl") {
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
            this.doorTimers[key] = this.timeSec;
          }
          const open = this.doorOpenAmount(room, obs);
          const gapRight = left + obs.openW * open;
          if (open <= 0.12) {
            if (fromX < left + 8 && x >= left - 2) {
              this.failRun("door");
              return fromX;
            }
          } else if (fromX < left + 4 && x > left - 2) {
            const passage = gapRight - left;
            // Walk arrives after the seal. Sprint still has a sliver wider than DOOR_SQUEEZE.
            if (passage < DOOR_SQUEEZE) {
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
    return this.doorOpenByKey(`${room.index}:door`, obs.closeTime);
  }

  private doorOpenByKey(key: string, closeTime: number): number {
    const started = this.doorTimers[key];
    if (started == null) return 1;
    const elapsed = this.timeSec - started;
    return clamp(1 - elapsed / closeTime, 0, 1);
  }

  private checkGapFail(): void {
    if (this.mode !== "playing") return;
    // A jump that just left the ground is still rising; don't treat air=2 as a fall.
    if (this.playerVy > 40) return;
    for (const room of this.layout.rooms) {
      for (const obs of room.obstacles ?? []) {
        if (obs.kind !== "gap") continue;
        const left = room.worldX + obs.x;
        const right = left + obs.w;
        // Feet in the hole. A full jump from the lip stays clear of a 122px gap; walking in does not.
        if (this.playerX > left + 8 && this.playerX < right - 8 && this.playerAir < 8) {
          this.failRun("flame");
          return;
        }
      }
    }
  }

  private updateDoorsAndElapsed(dt: number): void {
    this.elapsed += dt;
    for (const room of this.layout.rooms) {
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
    const room = roomAt(this.layout.rooms, this.playerX);
    if (room.index > this.lastRoomIndex) {
      for (let i = this.lastRoomIndex; i < room.index; i++) {
        if (this.flame >= 80) {
          this.roomFlamePoints += 50;
          this.score += 50;
        }
      }
      this.lastRoomIndex = room.index;
    }

    for (const r of this.layout.rooms) {
      for (const obs of r.obstacles ?? []) {
        const id = obstacleId(r.index, obs);
        if (this.scoredObstacles.has(id)) continue;
        const left = r.worldX + obs.x;
        if (this.runStartX >= left - 8) continue;
        if (obs.kind === "gap") {
          const right = left + obs.w;
          if (this.playerX >= right - 2) this.awardObstacle(id, 200);
        } else if (obs.kind === "crawl") {
          const right = left + obs.w;
          if (this.playerX >= right + 4) {
            this.awardObstacle(id, 150);
            this.finishHint("crawl");
          }
        } else if (obs.kind === "closingDoor") {
          const passX = left + obs.openW;
          if (this.playerX >= passX + 6) this.awardObstacle(id, 250);
        }
      }
    }
  }

  private updateHints(): void {
    if (this.mode !== "playing") {
      this.hud.setHint("");
      return;
    }
    let text = "";
    for (const room of this.layout.rooms) {
      for (const obs of room.obstacles ?? []) {
        const left = room.worldX + obs.x;
        if (obs.kind === "vault" && !this.jumpHintDone) {
          if (this.playerX > left + obs.w + 8) this.finishHint("jump");
          else if (this.playerX > left - 280 && this.playerX < left + 24) text = "Jump";
        } else if (obs.kind === "crawl" && !this.crawlHintDone) {
          if (this.playerX > left + obs.w + 8) this.finishHint("crawl");
          else if (!text && this.playerX > left - 300 && this.playerX < left + 20) text = "Hold Crawl";
        }
      }
    }
    this.hud.setHint(text);
  }

  private finishHint(which: "jump" | "crawl"): void {
    if (which === "jump") {
      if (this.jumpHintDone) return;
      this.jumpHintDone = true;
      this.writeFlag(HINT_JUMP_KEY);
    } else {
      if (this.crawlHintDone) return;
      this.crawlHintDone = true;
      this.writeFlag(HINT_CRAWL_KEY);
    }
  }

  private readFlag(key: string): boolean {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  }

  private writeFlag(key: string): void {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore quota / private mode */
    }
  }

  private failRun(reason: FailReason = "flame"): void {
    if (this.mode !== "playing") return;
    this.mode = "failing";
    this.failTimer = FAIL_BEAT;
    this.flame = 0;
    this.vaulting = false;
    this.sdk.gameplayStop();
    this.hud.showFail(reason, this.score);
  }

  private winRun(): void {
    this.mode = "won";
    this.sdk.gameplayStop();
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
    this.hud.showWin({
      obstacles: this.winBreakdown.obstacles,
      flame: this.winBreakdown.flame,
      time: this.winBreakdown.time,
      score: this.score,
      newBest: this.newBest,
    });
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
