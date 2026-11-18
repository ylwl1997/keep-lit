import { formatScore, formatTime } from "./scale";

export type FailReason = "flame" | "door";

export type HudHandlers = {
  onJump: () => void;
  onCrawlPress: () => void;
  onCupChange: (held: boolean) => void;
  onCrawlChange: (held: boolean) => void;
  onRunChange: (held: boolean) => void;
  onStart: () => void;
};

export class Hud {
  readonly cupHeld = (): boolean => this.held.cup;
  readonly crawlHeld = (): boolean => this.held.crawl;
  readonly runHeld = (): boolean => this.held.run;

  private readonly lintel: HTMLElement;
  private readonly roomName: HTMLElement;
  private readonly scoreLine: HTMLElement;
  private readonly bestLine: HTMLElement;
  private readonly attemptLine: HTMLElement;
  private readonly elapsed: HTMLElement;
  private readonly flameFill: HTMLElement;
  private readonly buttons: HTMLElement;
  private readonly titleScreen: HTMLElement;
  private readonly titleBest: HTMLElement;
  private readonly failScreen: HTMLElement;
  private readonly failLine: HTMLElement;
  private readonly failScore: HTMLElement;
  private readonly winScreen: HTMLElement;
  private readonly winObstacles: HTMLElement;
  private readonly winFlame: HTMLElement;
  private readonly winTime: HTMLElement;
  private readonly winScore: HTMLElement;
  private readonly winNewBest: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly btn: Record<"cup" | "jump" | "crawl" | "run", HTMLButtonElement>;
  private readonly held = { cup: false, jump: false, crawl: false, run: false };
  private readonly handlers: HudHandlers;

  constructor(root: HTMLElement, handlers: HudHandlers) {
    this.handlers = handlers;
    root.innerHTML = `
      <div id="lintel" class="hidden">
        <div class="lintel-body">
          <div class="hud-col left">
            <div id="room-name"></div>
            <div id="score-line"></div>
          </div>
          <div class="hud-col center">
            <div id="lantern">
              <div id="lantern-glass">
                <div id="flame-fill"></div>
                <div id="lantern-shine"></div>
              </div>
            </div>
            <div id="elapsed"></div>
          </div>
          <div class="hud-col right">
            <div id="best-line"></div>
            <div id="attempt-line"></div>
          </div>
        </div>
        <div class="lintel-edge"></div>
      </div>
      <div id="overlay">
        <div id="title-screen">
          <h1 id="title-wordmark"><span class="keep">Keep</span><span class="lit">Lit</span></h1>
          <div id="title-rule"></div>
          <p id="title-blurb">Hold to cup the flame. Jump, vault, crawl, or run when the house demands it.</p>
          <p id="title-cta">Press to begin</p>
          <p id="title-best" class="hidden"></p>
          <p id="title-keys">Cup  Space/F   ·   Jump/Vault  W/↑   ·   Crawl  S/↓   ·   Run  Shift</p>
        </div>
        <div id="fail-screen" class="hidden">
          <p id="fail-line"></p>
          <p id="fail-score"></p>
        </div>
        <div id="win-screen" class="hidden">
          <p id="win-line">The house is still lit.</p>
          <div id="win-ledger">
            <div class="row"><span>Obstacles</span><span id="win-obstacles">0</span></div>
            <div class="row"><span>Flame</span><span id="win-flame">0</span></div>
            <div class="row"><span>Time</span><span id="win-time">0</span></div>
            <div class="rule"></div>
            <div class="row total"><span>Score</span><span id="win-score">0</span></div>
            <div id="win-newbest" class="hidden">New best</div>
          </div>
          <p id="win-cta">Press to walk it again</p>
        </div>
      </div>
      <p id="action-hint" class="hidden"></p>
      <div id="buttons" class="hidden">
        <button type="button" class="plaque" id="btn-cup">Cup</button>
        <div class="right-btns">
          <button type="button" class="plaque" id="btn-jump">Jump</button>
          <button type="button" class="plaque" id="btn-crawl">Crawl</button>
          <button type="button" class="plaque" id="btn-run">Run</button>
        </div>
      </div>
    `;

    this.lintel = must(root, "#lintel");
    this.roomName = must(root, "#room-name");
    this.scoreLine = must(root, "#score-line");
    this.bestLine = must(root, "#best-line");
    this.attemptLine = must(root, "#attempt-line");
    this.elapsed = must(root, "#elapsed");
    this.flameFill = must(root, "#flame-fill");
    this.buttons = must(root, "#buttons");
    this.titleScreen = must(root, "#title-screen");
    this.titleBest = must(root, "#title-best");
    this.failScreen = must(root, "#fail-screen");
    this.failLine = must(root, "#fail-line");
    this.failScore = must(root, "#fail-score");
    this.winScreen = must(root, "#win-screen");
    this.winObstacles = must(root, "#win-obstacles");
    this.winFlame = must(root, "#win-flame");
    this.winTime = must(root, "#win-time");
    this.winScore = must(root, "#win-score");
    this.winNewBest = must(root, "#win-newbest");
    this.hint = must(root, "#action-hint");
    this.btn = {
      cup: must(root, "#btn-cup") as HTMLButtonElement,
      jump: must(root, "#btn-jump") as HTMLButtonElement,
      crawl: must(root, "#btn-crawl") as HTMLButtonElement,
      run: must(root, "#btn-run") as HTMLButtonElement,
    };

    this.bindButton("cup", true);
    this.bindButton("crawl", true);
    this.bindButton("run", true);
    this.bindButton("jump", false);

    this.titleScreen.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      this.handlers.onStart();
    });
    this.winScreen.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      this.handlers.onStart();
    });

    root.hidden = false;
  }

  isOnButton(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && Boolean(target.closest(".plaque"));
  }

  showTitle(best: number): void {
    this.lintel.classList.add("hidden");
    this.buttons.classList.add("hidden");
    this.failScreen.classList.add("hidden");
    this.winScreen.classList.add("hidden");
    this.titleScreen.classList.remove("hidden");
    if (best > 0) {
      this.titleBest.textContent = `Best  ${formatScore(best)}`;
      this.titleBest.classList.remove("hidden");
    } else {
      this.titleBest.textContent = "";
      this.titleBest.classList.add("hidden");
    }
  }

  showPlaying(): void {
    this.titleScreen.classList.add("hidden");
    this.failScreen.classList.add("hidden");
    this.winScreen.classList.add("hidden");
    this.lintel.classList.remove("hidden");
    this.buttons.classList.remove("hidden");
    this.setButtonEnabled(true);
  }

  showFail(reason: FailReason, score: number): void {
    this.titleScreen.classList.add("hidden");
    this.winScreen.classList.add("hidden");
    this.buttons.classList.add("hidden");
    this.lintel.classList.remove("hidden");
    this.failScreen.classList.remove("hidden");
    this.failLine.textContent = reason === "door" ? "The door closed." : "The flame went out.";
    this.failScore.textContent = `Score  ${formatScore(score)}`;
    this.clearHolds();
  }

  showWin(parts: { obstacles: number; flame: number; time: number; score: number; newBest: boolean }): void {
    this.titleScreen.classList.add("hidden");
    this.failScreen.classList.add("hidden");
    this.buttons.classList.add("hidden");
    this.lintel.classList.remove("hidden");
    this.winScreen.classList.remove("hidden");
    this.winObstacles.textContent = formatScore(parts.obstacles);
    this.winFlame.textContent = formatScore(parts.flame);
    this.winTime.textContent = formatScore(parts.time);
    this.winScore.textContent = formatScore(parts.score);
    this.winNewBest.classList.toggle("hidden", !parts.newBest);
    this.clearHolds();
  }

  updateRun(stats: {
    room: string;
    score: number;
    best: number;
    attempts: number;
    elapsed: number;
    flame: number;
    flameMax: number;
  }): void {
    this.roomName.textContent = stats.room;
    this.scoreLine.textContent = `Score  ${formatScore(stats.score)}`;
    this.bestLine.textContent = stats.best > 0 ? `Best  ${formatScore(stats.best)}` : "Best  —";
    this.attemptLine.textContent = stats.attempts > 1 ? `Attempt ${stats.attempts}` : "";
    this.elapsed.textContent = formatTime(stats.elapsed);
    const t = Math.max(0, Math.min(1, stats.flame / stats.flameMax));
    this.flameFill.style.width = `${(t * 100).toFixed(1)}%`;
  }

  setHint(text: string): void {
    if (!text) {
      this.hint.textContent = "";
      this.hint.classList.add("hidden");
      return;
    }
    this.hint.textContent = text;
    this.hint.classList.remove("hidden");
  }

  setHeldVisuals(state: { cup: boolean; jump: boolean; crawl: boolean; run: boolean }): void {
    this.paint("cup", state.cup, false);
    this.paint("crawl", state.crawl, false);
    this.paint("run", state.run, false);
    this.paint("jump", state.jump, true);
  }

  private setButtonEnabled(on: boolean): void {
    for (const b of Object.values(this.btn)) {
      b.disabled = !on;
      b.classList.toggle("disabled", !on);
    }
  }

  private clearHolds(): void {
    this.held.cup = false;
    this.held.jump = false;
    this.held.crawl = false;
    this.held.run = false;
    this.handlers.onCupChange(false);
    this.handlers.onCrawlChange(false);
    this.handlers.onRunChange(false);
  }

  private bindButton(id: "cup" | "jump" | "crawl" | "run", hold: boolean): void {
    const el = this.btn[id];
    const down = (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      this.held[id] = true;
      if (id === "jump") {
        this.paint(id, true, true);
        this.handlers.onJump();
        this.handlers.onStart();
      } else {
        this.paint(id, true, false);
        if (id === "cup") this.handlers.onCupChange(true);
        if (id === "crawl") {
          this.handlers.onCrawlPress();
          this.handlers.onCrawlChange(true);
        }
        if (id === "run") this.handlers.onRunChange(true);
        this.handlers.onStart();
      }
    };
    const up = (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.held[id] = false;
      this.paint(id, false, id === "jump");
      if (id === "cup") this.handlers.onCupChange(false);
      if (id === "crawl") this.handlers.onCrawlChange(false);
      if (id === "run") this.handlers.onRunChange(false);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    if (!hold) {
      // Jump flashes pressed, then returns to idle even if still down briefly.
      el.addEventListener("pointerup", () => {
        window.setTimeout(() => this.paint("jump", false, true), 80);
      });
    }
  }

  private paint(id: "cup" | "jump" | "crawl" | "run", on: boolean, momentary: boolean): void {
    const el = this.btn[id];
    el.classList.toggle("pressed", momentary && on);
    el.classList.toggle("held", !momentary && on);
  }
}

function must(root: HTMLElement, sel: string): HTMLElement {
  const el = root.querySelector(sel);
  if (!(el instanceof HTMLElement)) throw new Error(`Missing HUD node ${sel}`);
  return el;
}
