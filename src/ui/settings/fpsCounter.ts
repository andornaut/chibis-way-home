// The FPS counter tool's setting: off by default, a device setting kept in localStorage under its
// own key, apart from the versioned save, so Reset save keeps it.
const STORAGE_KEY = "chibis-way-home.fps-counter";
const ON = "on";

let shown: boolean | undefined;
const listeners = new Set<(on: boolean) => void>();

// Reading or writing localStorage throws where the browser blocks site data; the setting then
// lasts only until the page reloads.
export function fpsCounterShown(): boolean {
  if (shown === undefined) {
    try {
      shown = globalThis.localStorage.getItem(STORAGE_KEY) === ON;
    } catch {
      shown = false;
    }
  }
  return shown;
}

export function setFpsCounterShown(on: boolean): void {
  shown = on;
  try {
    if (on) {
      globalThis.localStorage.setItem(STORAGE_KEY, ON);
    } else {
      globalThis.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Kept for this page only.
  }
  listeners.forEach((listener) => listener(on));
}

// Calls listener with each change; returns its removal.
export function watchFpsCounter(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
