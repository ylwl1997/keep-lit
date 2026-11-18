import Phaser from "phaser";
import { hideBootStatus, installCrashOverlay } from "./crash-overlay";
import { initGameSdk, type GameSdk } from "./sdk";

export async function prepareSdk(): Promise<GameSdk> {
  installCrashOverlay();
  const sdk = await initGameSdk();
  sdk.loadingStart();
  return sdk;
}

export function startPhaserGame(config: Phaser.Types.Core.GameConfig): Phaser.Game {
  hideBootStatus();
  const { parent: _ignoredParent, ...rest } = config;
  return new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: "#140f0a",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 800,
    },
    input: {
      activePointers: 3,
    },
    ...rest,
    parent: "game",
  });
}
