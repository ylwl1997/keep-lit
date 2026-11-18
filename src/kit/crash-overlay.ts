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
      font-family: system-ui, sans-serif;
      font-size: 18px;
      line-height: 1.4;
      color: #c9b48a;
      background: #140f0a;
      z-index: 10;
      pointer-events: none;
    }
    #boot-error {
      color: #f4e6c5;
      pointer-events: auto;
      white-space: pre-wrap;
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

export function installCrashOverlay() {
  if (window.__kitCrashOverlayInstalled) return;
  window.__kitCrashOverlayInstalled = true;
  ensureStyle();
  window.addEventListener("error", (event) => {
    const msg =
      event.error instanceof Error
        ? (event.error.stack ?? event.error.message)
        : event.message;
    showBootError(msg || "The game failed to start.");
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? (reason.stack ?? reason.message)
        : String(reason ?? "The game failed to start.");
    showBootError(msg);
  });
}

declare global {
  interface Window {
    __kitCrashOverlayInstalled?: boolean;
  }
}
