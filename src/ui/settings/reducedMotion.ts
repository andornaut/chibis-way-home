// The Reduced motion setting, on when motion is reduced: refusal feedback holds steady red with
// no shake or flash, the hazard contact cue holds steady without the world shake and a defeated
// boss's puff holds its first frame. Until the player sets it on a device it follows the device's
// reduced-motion preference, changes included; once set, the player's choice is kept in
// localStorage under its own key, apart from the versioned save.
const STORAGE_KEY = "chibis-way-home.reduced-motion";
const OFF = "off";
const ON = "on";

// The player's choice from its stored value, or undefined when there is none.
export function decodeReducedMotion(stored: string | null): boolean | undefined {
  return stored === ON ? true : stored === OFF ? false : undefined;
}

export function encodeReducedMotion(on: boolean): string {
  return on ? ON : OFF;
}

// Reading or writing localStorage throws where the browser blocks site data; a choice then lasts
// only until the page reloads.
function readStored(host: Window): string | null {
  try {
    return host.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// The player's choice per window, null when none is stored.
const choices = new WeakMap<Window, boolean | null>();
// One query list per window, whose matches follows the device.
const queries = new WeakMap<Window, MediaQueryList>();

function devicePrefersReducedMotion(host: Window): boolean {
  let query = queries.get(host);
  if (!query) {
    query = host.matchMedia("(prefers-reduced-motion: reduce)");
    queries.set(host, query);
  }
  return query.matches;
}

export function reducedMotion(host: Window): boolean {
  let choice = choices.get(host);
  if (choice === undefined) {
    choice = decodeReducedMotion(readStored(host)) ?? null;
    choices.set(host, choice);
  }
  return choice ?? devicePrefersReducedMotion(host);
}

export function setReducedMotion(host: Window, on: boolean): void {
  choices.set(host, on);
  try {
    host.localStorage.setItem(STORAGE_KEY, encodeReducedMotion(on));
  } catch {
    // Kept for this page only.
  }
}
