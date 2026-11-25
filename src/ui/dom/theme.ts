import {
  colourProperties,
  TEXT_ROLES,
  type UiColourRole,
} from "@andornaut/game-kit/runtime/ui/uiTheme";
import {
  type LayoutValues,
  writeLayoutProperties,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";
import { setTextRoles, setUiColours } from "@andornaut/game-kit/runtime/web/ui/dom/uiTheme";

import { TEXT_ROLE_STYLES } from "../layout/fontRoles.ts";

// The interface's theme on the kit's (uiTheme.css): each colour slot's palette colour, and the
// text roles. Art's nine-slice frames draw the idle, primary and disabled button faces, so those
// face slots stay unset; the focus and pressed slots fill the face inside its frame.
export const THEME_COLOURS = {
  accent: "yellow",
  buttonDisabledText: "dslate",
  buttonFocusFace: "yellow",
  buttonFocusText: "ink",
  buttonPressedFace: "amber",
  buttonPressedText: "ink",
  buttonPrimaryText: "white",
  buttonText: "ink",
  frame: "ink",
  textPrimary: "ink",
  textSecondary: "dslate",
} as const satisfies Partial<Record<UiColourRole, string>>;

type Role = keyof typeof TEXT_ROLE_STYLES;

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

// The class of a text role.
export function textRole(role: Role): string {
  return `ui-text-${kebab(role)}`;
}

// The slots' custom properties for a palette's #rrggbb colours by name.
export function themeColours(colours: Readonly<Record<string, string>>): Record<string, string> {
  return colourProperties(
    Object.fromEntries(
      Object.entries(THEME_COLOURS).map(([role, name]) => {
        const colour = colours[name];
        if (colour === undefined) {
          throw new Error(`The palette has no ${name}`);
        }
        return [role, colour];
      }),
    ),
  );
}

// Marks root as the theme's and writes its colour slots.
export function setThemeColours(
  colours: Readonly<Record<string, string>>,
  root: HTMLElement,
): void {
  setUiColours(
    Object.fromEntries(Object.entries(THEME_COLOURS).map(([role, name]) => [role, colours[name]!])),
    root,
  );
}

// Writes every text role's size, line height and weight on root: the kit's through its theme,
// and this game's as the same properties under their own names.
export function setThemeText(root: HTMLElement): void {
  const kit = TEXT_ROLES as readonly string[];
  setTextRoles(
    Object.fromEntries(Object.entries(TEXT_ROLE_STYLES).filter(([role]) => kit.includes(role))),
    root,
  );
  const own: Record<string, number> = {};
  for (const [role, style] of Object.entries(TEXT_ROLE_STYLES)) {
    if (!kit.includes(role)) {
      own[`--${textRole(role as Role)}-size`] = style.size;
      own[`--${textRole(role as Role)}-line-height`] = style.lineHeight;
      own[`--${textRole(role as Role)}-weight`] = style.weight;
    }
  }
  writeLayoutProperties(own satisfies LayoutValues, root);
}
