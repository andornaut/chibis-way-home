// The touch settings: whether the move hint shows (Move controls) and whether Use and Jump show
// (Action buttons), each Shown unless the player hides it. Hiding one hides only its drawing:
// movement and the button presses still work. Each is kept in localStorage under its own key.
export type TouchSetting = "actionButtons" | "moveControls";

export const TOUCH_SETTINGS: readonly TouchSetting[] = ["moveControls", "actionButtons"];

const STORAGE_KEYS: Readonly<Record<TouchSetting, string>> = {
  actionButtons: "chibis-way-home.action-buttons",
  moveControls: "chibis-way-home.move-controls",
};
// CLEANUP (added 2026-10-29): the single Touch controls setting the two replace, read for a
// setting the player has not set since. Remove once every player's game has stored both.
const OLD_STORAGE_KEY = "chibis-way-home.touch-controls";
const HIDDEN = "hidden";
const SHOWN = "shown";

// A setting from its own stored value or, with none, the old single setting's: shown for
// anything but the hidden value, nothing stored included.
export function decodeTouchSetting(own: string | null, old: string | null): boolean {
  return (own ?? old) !== HIDDEN;
}

export function encodeTouchSetting(shown: boolean): string {
  return shown ? SHOWN : HIDDEN;
}

// Reading or writing localStorage throws where the browser blocks site data; a setting then
// lasts only until the page reloads.
function readStored(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const shown = new Map<TouchSetting, boolean>();

export function touchSettingShown(setting: TouchSetting): boolean {
  let value = shown.get(setting);
  if (value === undefined) {
    value = decodeTouchSetting(readStored(STORAGE_KEYS[setting]), readStored(OLD_STORAGE_KEY));
    shown.set(setting, value);
  }
  return value;
}

// Every touch setting as it stands.
export function touchSettings(): Readonly<Record<TouchSetting, boolean>> {
  return {
    actionButtons: touchSettingShown("actionButtons"),
    moveControls: touchSettingShown("moveControls"),
  };
}

export function setTouchSettingShown(setting: TouchSetting, value: boolean): void {
  shown.set(setting, value);
  try {
    globalThis.localStorage.setItem(STORAGE_KEYS[setting], encodeTouchSetting(value));
  } catch {
    // Kept for this page only.
  }
}
