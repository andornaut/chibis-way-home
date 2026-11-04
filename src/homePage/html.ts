import { readFile } from "node:fs/promises";

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

const WEB_MANIFEST = "manifest.webmanifest";

// The web app manifest (public/manifest.webmanifest) with the home page's description in place
// of its "%HOME_DESCRIPTION%" string.
export function webManifestJson(text: GameText, json: string): string {
  if (!json.includes('"%HOME_DESCRIPTION%"')) {
    throw new Error(`${WEB_MANIFEST} has no "%HOME_DESCRIPTION%" description`);
  }
  return json.replace('"%HOME_DESCRIPTION%"', JSON.stringify(text.homePage.description));
}

// Renders the manifest's description in dev and in the build output. In a build it runs after the
// kit's hashedIconsPlugin writes the manifest and before precachePlugin reads it, so vite.config.ts
// lists it between them.
export function webManifestPlugin(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use(`/${WEB_MANIFEST}`, (_request, response, next) => {
        readFile(`${server.config.publicDir}/${WEB_MANIFEST}`, "utf8").then((json) => {
          response.setHeader("Content-Type", "application/manifest+json");
          response.end(webManifestJson(TEXT, json));
        }, next);
      });
    },
    enforce: "post",
    generateBundle(_options, bundle) {
      const file = bundle[WEB_MANIFEST];
      if (file?.type !== "asset") {
        this.error(`${WEB_MANIFEST} is not in the build output`);
      }
      const { source } = file;
      file.source = webManifestJson(
        TEXT,
        typeof source === "string" ? source : new TextDecoder().decode(source),
      );
    },
    name: "home-page-web-manifest",
  };
}
