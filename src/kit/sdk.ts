export type SdkEnvironment = "local" | "crazygames" | "disabled" | "missing";

export type GameSdk = {
  environment: SdkEnvironment;
  loadingStart: () => void;
  loadingStop: () => void;
  gameplayStart: () => void;
  gameplayStop: () => void;
};

type CrazyGamesSdk = {
  init: () => Promise<void>;
  environment: "local" | "crazygames" | "disabled" | "uninitialized";
  game: {
    loadingStart: () => void;
    loadingStop: () => void;
    gameplayStart: () => void;
    gameplayStop: () => void;
  };
};

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazyGamesSdk };
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function noopSdk(environment: SdkEnvironment): GameSdk {
  const ignore = () => undefined;
  return {
    environment,
    loadingStart: ignore,
    loadingStop: ignore,
    gameplayStart: ignore,
    gameplayStop: ignore,
  };
}

function isCrazyGamesHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "crazygames.com" ||
    host.endsWith(".crazygames.com") ||
    host === "crazygames.lunalabs.io" ||
    host.endsWith(".crazygames.lunalabs.io")
  );
}

/**
 * Skip the official parent handshake when the game is opened top-level on
 * our own domain (GitHub Pages, workers.dev, a custom site). Always init
 * inside an iframe, on 127.0.0.1, or on a CrazyGames host.
 */
export function shouldInitCrazyGamesSdk(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("useLocalSdk") === "true") return true;
  const host = window.location.hostname;
  if (LOCAL_HOSTS.has(host) || isCrazyGamesHost(host)) return true;
  if (window.parent !== window) return true;
  return false;
}

function wrap(fn: () => void): () => void {
  return () => {
    try {
      fn();
    } catch {
      // The official SDK throws when the environment is disabled.
    }
  };
}

function waitForSdk(maxMs: number): Promise<CrazyGamesSdk | null> {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const sdk = window.CrazyGames?.SDK;
      if (sdk) {
        resolve(sdk);
        return;
      }
      if (Date.now() - started >= maxMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 40);
    };
    tick();
  });
}

/**
 * Never throws. Top-level sites that are not CrazyGames resolve immediately
 * as disabled. A missing or hung SDK resolves as missing so the game can boot.
 */
export async function initGameSdk(): Promise<GameSdk> {
  if (!shouldInitCrazyGamesSdk()) return noopSdk("disabled");

  const sdk = await waitForSdk(700);
  if (!sdk) return noopSdk("missing");

  try {
    await Promise.race([
      sdk.init(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("CrazyGames SDK init timed out")), 1200);
      }),
    ]);
  } catch {
    return noopSdk("missing");
  }

  if (sdk.environment !== "local" && sdk.environment !== "crazygames") {
    return noopSdk("disabled");
  }

  return {
    environment: sdk.environment,
    loadingStart: wrap(() => sdk.game.loadingStart()),
    loadingStop: wrap(() => sdk.game.loadingStop()),
    gameplayStart: wrap(() => sdk.game.gameplayStart()),
    gameplayStop: wrap(() => sdk.game.gameplayStop()),
  };
}
