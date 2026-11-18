import "./style.css";
import { hideBootStatus, installCrashOverlay, showBootError, showSdkWarning } from "./kit/crash-overlay";
import { initGameSdk, noopSdk, type GameSdk } from "./kit/sdk";
import { GameApp } from "./game/GameApp";

function fitStage(): void {
  const game = document.getElementById("game");
  const stage = document.getElementById("stage");
  if (!game || !stage) return;
  const scale = Math.min(game.clientWidth / 1280, game.clientHeight / 800);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

/**
 * Boot the scene immediately. SDK calls are forwarded when init finishes.
 * A missing or failed SDK shows a warning and never holds the first frame.
 */
function connectSdk(): GameSdk {
  let current: GameSdk = noopSdk("disabled");
  let pending = true;
  const queued: Array<"loadingStart" | "loadingStop" | "gameplayStart" | "gameplayStop"> = [];
  const forward = (name: (typeof queued)[number]) => () => {
    if (pending) queued.push(name);
    else current[name]();
  };
  void initGameSdk().then((sdk) => {
    pending = false;
    current = sdk;
    if (sdk.environment === "missing") {
      showSdkWarning("CrazyGames SDK unavailable. You can still play.");
    }
    for (const name of queued) sdk[name]();
    queued.length = 0;
  }).catch(() => {
    pending = false;
    showSdkWarning("CrazyGames SDK failed. You can still play.");
  });
  return {
    get environment() {
      return current.environment;
    },
    loadingStart: forward("loadingStart"),
    loadingStop: forward("loadingStop"),
    gameplayStart: forward("gameplayStart"),
    gameplayStop: forward("gameplayStop"),
  };
}

function start(): void {
  installCrashOverlay();
  const sdk = connectSdk();
  sdk.loadingStart();

  const container = document.getElementById("game");
  const canvas = document.getElementById("view");
  if (!container || !(canvas instanceof HTMLCanvasElement)) {
    showBootError("Missing #game container or canvas.");
    return;
  }

  fitStage();
  window.addEventListener("resize", fitStage);

  try {
    hideBootStatus();
    new GameApp(container, canvas, sdk);
  } catch (err) {
    sdk.loadingStop();
    const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
    showBootError(msg || "Keep Lit failed to start.");
  }
}

start();
