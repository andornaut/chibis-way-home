import { FONT_ROLES } from "../layout/fontRoles.ts";

const UI_FONTS = {
  display: "block",
  faces: [
    {
      key: FONT_ROLES.body,
      role: "body",
      style: "normal",
      url: "/art/fonts/liberation/LiberationSans-Regular.ttf",
      weight: "400",
    },
    {
      key: FONT_ROLES.heading,
      role: "heading",
      style: "normal",
      url: "/art/fonts/liberation/LiberationSans-Bold.ttf",
      weight: "700",
    },
  ],
  family: "Liberation Sans",
  format: "truetype",
} as const;

export const UI_FONT_FAMILY = UI_FONTS.family;
export const UI_FONT_RESOURCES = UI_FONTS.faces;

const registered = new WeakSet<Document>();

// Native font faces avoid inline styles and start loading only when the UI requests them.
export function registerUiFonts(document: Document): void {
  if (registered.has(document) || document.fonts === undefined || typeof FontFace === "undefined") {
    return;
  }
  for (const { style, url, weight } of UI_FONT_RESOURCES) {
    document.fonts.add(
      new FontFace(UI_FONT_FAMILY, `url("${url}") format("${UI_FONTS.format}")`, {
        display: UI_FONTS.display,
        style,
        weight,
      }),
    );
  }
  registered.add(document);
}
