const STYLE_ID = "kit-crash-overlay-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #boot-status, #boot-error {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      font-family: Fraunces, "EB Garamond", Georgia, "Palatino Linotype", Palatino, "Times New Roman", serif;
      font-size: 18px;
      line-height: 1.4;
      color: #c9b48a;
      background: #140f0a;
      z-index: 20;
      pointer-events: none;
    }
    #boot-error {
      color: #f4e6c5;
      pointer-events: auto;
      white-space: pre-wrap;
    }
    #sdk-warning {
      position: absolute;
      left: 50%;
      top: 16px;
      transform: translateX(-50%);
      z-index: 25;
      max-width: min(640px, calc(100% - 32px));
      padding: 10px 16px;
      text-align: center;
      font-family: Fraunces, "EB Garamond", Georgia, "Palatino Linotype", Palatino, "Times New Roman", serif;
      font-size: 16px;
      line-height: 1.35;
      color: #f4e6c5;
      background: #1a1410;
      border: 2px solid #8a5a32;
      box-shadow: 0 6px 0 #2a1810;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

export function hideBootStatus() {
  document.getElementById("boot-status")?.remove();
}

export function showBootError(message: string) {
  hideBootStatus();
  ensureStyle();
  let el = document.getElementById("boot-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "boot-error";
    (document.getElementById("game") ?? document.body).appendChild(el);
  }
  el.textContent = message;
}

/** Visible, non-blocking notice. The game keeps running underneath. */
export function showSdkWarning(message: string) {
  ensureStyle();
  let el = document.getElementById("sdk-warning");
  if (!el) {
    el = document.createElement("div");
    el.id = "sdk-warning";
    (document.getElementById("game") ?? document.body).appendChild(el);
  }
  el.textContent = message;
}

function isSdkNoise(event: Event): boolean {
  const target = event.target;
  if (target instanceof HTMLScriptElement && (target.src || "").includes("crazygames")) return true;
  if (event instanceof ErrorEvent && (event.filename || "").includes("crazygames")) return true;
  return false;
}

export function installCrashOverlay() {
  if (window.__kitCrashOverlayInstalled) return;
  window.__kitCrashOverlayInstalled = true;
  ensureStyle();
  window.addEventListener("error", (event) => {
    if (isSdkNoise(event)) return;
    const msg =
      event.error instanceof Error
        ? (event.error.stack ?? event.error.message)
        : event.message;
    if (!msg) return;
    showBootError(msg);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? (reason.stack ?? reason.message)
        : String(reason ?? "The game failed to start.");
    if (msg.includes("crazygames") || msg.includes("CrazyGames")) {
      showSdkWarning("CrazyGames SDK failed. You can still play.");
      return;
    }
    showBootError(msg);
  });
}

declare global {
  interface Window {
    __kitCrashOverlayInstalled?: boolean;
  }
}
