import { createHash } from "node:crypto";

import { progressBarLayout } from "@andornaut/game-kit/progress";
import type { Plugin } from "vite";

import { PROGRESS_RECT, stageProgressStyle } from "./style";

const style = stageProgressStyle();
const layout = progressBarLayout(style, PROGRESS_RECT, undefined);
const colour = (value: number) => `#${value.toString(16).padStart(6, "0")}`;
const fill = layout.fills[0]!;

// A separate stylesheet preserves the page's self-only style policy before modules load.
export const LOADING_CSS = `
#game { position: relative; }
#game-loading {
  position: absolute; top: 0; left: 50%; width: ${PROGRESS_RECT.width}px;
  height: ${PROGRESS_RECT.height}px; pointer-events: none; z-index: 1;
  transform: translateX(-50%) scale(var(--loading-scale,1)); transform-origin: top center;
}
#game-loading > .initial-loading {
  position: absolute; width: ${PROGRESS_RECT.width}px; height: ${PROGRESS_RECT.height}px;
  background: ${colour(style.track)};
}
#game-loading > .initial-loading > div {
  position: absolute; left: ${fill.x}px; width: ${fill.width}px; height: ${fill.height}px;
  background: ${colour(style.fills[0]!)};
}
`;
const CSS_FILE = `assets/loading-${createHash("sha256").update(LOADING_CSS).digest("hex").slice(0, 8)}.css`;

// Initial HTML uses the same geometry as the DOM and Phaser adapters, with no script or style inline.
export function loadingHtml(html: string): string {
  if (!html.includes("%GAME_LOADING%")) {
    return html;
  }
  return html
    .replace("</head>", `<link rel="stylesheet" href="/${CSS_FILE}" /></head>`)
    .replace(
      "%GAME_LOADING%",
      [
        '<div id="game-loading"><div class="initial-loading" role="progressbar"',
        'aria-labelledby="game" aria-valuemin="0" aria-valuemax="1"><div></div></div></div>',
      ].join(" "),
    );
}

export function loadingPlugin(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== `/${CSS_FILE}`) {
          next();
          return;
        }
        response.setHeader("Content-Type", "text/css");
        response.end(LOADING_CSS);
      });
    },
    generateBundle() {
      this.emitFile({ fileName: CSS_FILE, source: LOADING_CSS, type: "asset" });
    },
    name: "game-loading-indicator",
    transformIndexHtml: { handler: loadingHtml, order: "post" },
  };
}
