import type { Plugin } from "vite";

import { TEXT } from "../data/text";
import type { GameText } from "../data/types";
import { actionHelpCss, actionHelpHtml, escaped } from "./actionHelp";

// The same escaped description fills both the visible pitch and its metadata.
export function homePageHtml(text: GameText, html: string): string {
  const copy: Readonly<Record<string, string>> = {
    DESCRIPTION: text.homePage.description,
    INSTALL: text.settings.installButton,
    PLAY: text.homePage.play,
    SUBLINE: text.homePage.subline,
  };
  return html
    .replace("<!-- HOME_ACTION_STYLE -->", `<style>${actionHelpCss()}</style>`)
    .replace(/%HOME_([A-Z_]+)%/gu, (_, key: string) => {
      if (key === "INSTRUCTIONS") {
        return text.homePage.instructions
          .map((line) => `<li>${actionHelpHtml(text.buttons, line)}</li>`)
          .join("\n");
      }
      const value = copy[key];
      if (value === undefined) {
        throw new Error(`Unknown homepage copy token ${key}`);
      }
      return escaped(value);
    });
}

// Vite renders the copy in dev and production, before HTML assets and headers are processed.
export function homePagePlugin(): Plugin {
  return {
    name: "home-page-copy",
    transformIndexHtml: {
      handler: (html) => homePageHtml(TEXT, html),
      order: "pre",
    },
  };
}
