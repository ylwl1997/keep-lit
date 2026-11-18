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

function noop(environment: SdkEnvironment): GameSdk {
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
 * Skip the official 7s parent handshake when the game is opened top-level on
 * our own domain (workers.dev, a custom site). Always init inside an iframe,
 * on localhost / 127.0.0.1, or on a CrazyGames host.
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

export async function initGameSdk(): Promise<GameSdk> {
  const sdk = window.CrazyGames?.SDK;
  if (!sdk) return noop("missing");
  if (!shouldInitCrazyGamesSdk()) return noop("disabled");

  try {
    await Promise.race([
      sdk.init(),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("CrazyGames SDK init timed out")), 8000);
      }),
    ]);
  } catch {
    return noop("disabled");
  }

  if (sdk.environment !== "local" && sdk.environment !== "crazygames") {
    return noop("disabled");
  }

  return {
    environment: sdk.environment,
    loadingStart: wrap(() => sdk.game.loadingStart()),
    loadingStop: wrap(() => sdk.game.loadingStop()),
    gameplayStart: wrap(() => sdk.game.gameplayStart()),
    gameplayStop: wrap(() => sdk.game.gameplayStop()),
  };
}
