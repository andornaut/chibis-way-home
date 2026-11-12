import { readFile } from "node:fs/promises";

import { BUTTON_GAP } from "@andornaut/game-kit/ui/spacing";
import type { Plugin } from "vite";

import { TEXT } from "../data/text.ts";
import type { GameText } from "../data/types/index.ts";
import { actionHelpCss, actionHelpHtml, escaped } from "./actionHelp.ts";

// The steps dialog's sections, one per kind of browser in kind order, each marked data-steps with
// its kind and titled by its h2, hidden until the install button shows the browser's own.
export function installStepsHtml(steps: GameText["settings"]["installSteps"]): string {
  return Object.entries(steps)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([kind, { steps: paragraph, title }]) =>
        `<div data-steps="${kind}" hidden>` +
        `<h2 id="install-steps-${kind}">${escaped(title)}</h2>` +
        `<p>${escaped(paragraph)}</p></div>`,
    )
    .join("\n");
}

// Install and Play sit the kit's button gap apart, in CSS px.
export function homeActionsCss(): string {
  return `.actions { gap:${BUTTON_GAP}px; }`;
}

// The same escaped description fills both the visible pitch and its metadata.
export function homePageHtml(text: GameText, html: string): string {
  const copy: Readonly<Record<string, string>> = {
    DESCRIPTION: text.homePage.description,
    INSTALL: text.settings.installButton,
    PLAY: text.homePage.play,
    SUBLINE: text.homePage.subline,
  };
  return html
    .replace("<!-- HOME_ACTION_STYLE -->", `<style>${actionHelpCss()}${homeActionsCss()}</style>`)
    .replace(/%HOME_([A-Z_]+)%/gu, (_, key: string) => {
      if (key === "INSTRUCTIONS") {
        return text.homePage.instructions
          .map((line) => `<li>${actionHelpHtml(text.buttons, line)}</li>`)
          .join("\n");
      }
      if (key === "INSTALL_STEPS") {
        return installStepsHtml(text.settings.installSteps);
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
