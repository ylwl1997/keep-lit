import "./style.css";
import { hideBootStatus, installCrashOverlay, showBootError } from "./kit/crash-overlay";
import { initGameSdk } from "./kit/sdk";
import { GameApp } from "./game/GameApp";

function fitStage(): void {
  const game = document.getElementById("game");
  const stage = document.getElementById("stage");
  if (!game || !stage) return;
  const scale = Math.min(game.clientWidth / 1280, game.clientHeight / 800);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

async function start(): Promise<void> {
  installCrashOverlay();
  const sdk = await initGameSdk();
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

void start();
