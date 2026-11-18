import { prepareSdk, startPhaserGame } from "./kit/boot";
import { showBootError } from "./kit/crash-overlay";
import { PlayScene } from "./game/PlayScene";

async function boot(): Promise<void> {
  const sdk = await prepareSdk();
  startPhaserGame({
    backgroundColor: "#140f0a",
    scene: [PlayScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set("sdk", sdk);
      },
    },
  });
}

boot().catch((err: unknown) => {
  const message =
    err instanceof Error ? (err.stack ?? err.message) : String(err ?? "The game failed to start.");
  showBootError(message);
});
