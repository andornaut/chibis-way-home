// The Invincibility cheat (gameplay/cheats.md): off by default, a device setting kept in
// localStorage under its own key, apart from the versioned save, so Restart and Reset save keep it.
const STORAGE_KEY = "chibis-way-home.invincibility";
const ON = "on";

let invulnerable: boolean | undefined;

// Reading or writing localStorage throws where the browser blocks site data; the setting then
// lasts only until the page reloads.
export function invulnerabilityEnabled(): boolean {
  if (invulnerable === undefined) {
    try {
      invulnerable = globalThis.localStorage.getItem(STORAGE_KEY) === ON;
    } catch {
      invulnerable = false;
    }
  }
  return invulnerable;
}

export function setInvulnerability(enabled: boolean): void {
  invulnerable = enabled;
  try {
    if (enabled) {
      globalThis.localStorage.setItem(STORAGE_KEY, ON);
    } else {
      globalThis.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Kept for this page only.
  }
}
