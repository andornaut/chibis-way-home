import { colourProperties, TEXT_ROLES } from "@andornaut/game-kit/runtime/ui/uiTheme";
import {
  setGameTextRoles,
  setTextRoles,
  setUiColours,
} from "@andornaut/game-kit/runtime/web/ui/dom/uiTheme";

import { THEME_COLOURS } from "../../data/layout.ts";
import { TEXT_ROLE_STYLES } from "../layout/fontRoles.ts";

// The interface's theme on the kit's (uiTheme.css): each colour slot's palette colour
// (THEME_COLOURS in src/data/layout.ts) and the text roles. The focus and pressed slots fill a
// button's face inside its frame.

// A clear slot's colour: art draws that face.
const CLEAR = "#00000000";

// Each slot's colour from a palette's #rrggbb colours by name.
function slotColours(colours: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(THEME_COLOURS).map(([role, name]) => {
      const colour = name === "clear" ? CLEAR : colours[name];
      if (colour === undefined) {
        throw new Error(`The palette has no ${name}`);
      }
      return [role, colour];
    }),
  );
}

// The slots' custom properties for a palette's #rrggbb colours by name.
export function themeColours(colours: Readonly<Record<string, string>>): Record<string, string> {
  return colourProperties(slotColours(colours));
}

// Marks root as the theme's and writes its colour slots.
export function setThemeColours(
  colours: Readonly<Record<string, string>>,
  root: HTMLElement,
): void {
  setUiColours(slotColours(colours), root);
}

// Writes every text role's size, line height and weight on root: the kit's four and this game's.
export function setThemeText(root: HTMLElement): void {
  const kit = TEXT_ROLES as readonly string[];
  const ours = (own: boolean) =>
    Object.fromEntries(
      Object.entries(TEXT_ROLE_STYLES).filter(([role]) => kit.includes(role) !== own),
    );
  setTextRoles(ours(false), root);
  setGameTextRoles(ours(true), root);
}
