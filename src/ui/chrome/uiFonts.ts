import type { RequiredLoadingResource } from "@andornaut/game-kit/runtime/load/loadingAttempts";

import { FONT_ROLES } from "../layout/index.ts";

const UI_FONTS = {
  display: "block",
  faces: [
    {
      key: FONT_ROLES.body,
      role: "body",
      style: "normal",
      url: "/art/fonts/chibi-sans/ChibiSans-Regular.woff2",
      weight: "400",
    },
    {
      key: FONT_ROLES.heading,
      role: "heading",
      style: "normal",
      url: "/art/fonts/chibi-sans/ChibiSans-Bold.woff2",
      weight: "700",
    },
  ],
  family: "Chibi Sans",
  format: "woff2",
} as const;

export const UI_FONT_FAMILY = UI_FONTS.family;
export const UI_FONT_RESOURCES = UI_FONTS.faces;

const registered = new WeakMap<Document, readonly RequiredLoadingResource[]>();

// Native font faces avoid inline styles and start loading only when the UI requests them.
export function registerUiFonts(document: Document): void {
  if (registered.has(document) || document.fonts === undefined || typeof FontFace === "undefined") {
    return;
  }
  const resources = UI_FONT_RESOURCES.map(({ style, url, weight }): RequiredLoadingResource => {
    const create = () =>
      new FontFace(UI_FONT_FAMILY, `url("${url}") format("${UI_FONTS.format}")`, {
        display: UI_FONTS.display,
        style,
        weight,
      });
    let face = create();
    let loading: Promise<void> | undefined;
    document.fonts.add(face);
    return {
      retry() {
        if (face.status === "loaded") {
          return Promise.resolve();
        }
        if (loading !== undefined) {
          return loading;
        }
        if (face.status === "error") {
          document.fonts.delete(face);
          face = create();
          document.fonts.add(face);
        }
        loading = face
          .load()
          .then(() => undefined)
          .finally(() => {
            loading = undefined;
          });
        return loading;
      },
      status: () =>
        face.status === "loaded" ? "ready" : face.status === "error" ? "failed" : "loading",
    };
  });
  registered.set(document, resources);
}

// Successful faces stay registered; only an errored face is replaced for an explicit retry.
export function requiredUiFonts(document: Document): readonly RequiredLoadingResource[] {
  registerUiFonts(document);
  const resources = registered.get(document);
  if (resources === undefined) {
    throw new Error("Required UI fonts are unavailable");
  }
  return resources;
}
