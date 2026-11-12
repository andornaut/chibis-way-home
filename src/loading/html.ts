import { createHash } from "node:crypto";

import { progressBarLayout } from "@andornaut/game-kit/progress";
import {
  PROGRESS_BAR_BAND_CLASS,
  PROGRESS_BAR_CLASS,
  PROGRESS_BAR_PROPERTIES,
  progressBarPixelProperties,
} from "@andornaut/game-kit/web/progress/dom/progressBar";
import type { Plugin } from "vite";

import { LOADING_TIMING, PROGRESS_RECT, stageProgressStyle } from "./style.ts";

const style = stageProgressStyle();
// The bands span the track while pending; their segments travel by the kit's progressBar.css.
const layout = progressBarLayout(style, PROGRESS_RECT, 1);
// The timing the script-mounted bar writes: the cycle, full hold, fade and segment, and the
// segment's whole-pixel width and step count, set together so pre-script markup steps its travel
// one pixel at a time as the script-mounted bar does.
const timingProperties = Object.entries({
  [PROGRESS_BAR_PROPERTIES.cycle]: `${LOADING_TIMING.cycleMs}ms`,
  [PROGRESS_BAR_PROPERTIES.fade]: `${LOADING_TIMING.fadeMs}ms`,
  [PROGRESS_BAR_PROPERTIES.full]: `${LOADING_TIMING.fullMs}ms`,
  [PROGRESS_BAR_PROPERTIES.segment]: String(LOADING_TIMING.segment),
  ...progressBarPixelProperties(style, LOADING_TIMING, PROGRESS_RECT),
})
  .map(([name, value]) => `${name}: ${value};`)
  .join(" ");
const colour = (value: number) => `#${value.toString(16).padStart(6, "0")}`;
const px = ({ height, width, x, y }: { height: number; width: number; x: number; y: number }) =>
  `left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px;`;

// A separate stylesheet preserves the page's self-only style policy before modules load. The
// markup is the kit's DOM progress bar, pending; the bands clip their segments here, since the
// kit's adapter sets their overflow only from script. The track is the bar's first child, so
// band n is child n + 2.
export const LOADING_CSS = `
#game { position: relative; }
#game-loading {
  position: absolute; top: 0; left: 50%; width: ${PROGRESS_RECT.width}px;
  height: ${PROGRESS_RECT.height}px; pointer-events: none; z-index: 1;
  transform: translateX(-50%) scale(var(--loading-scale,1)); transform-origin: top center;
}
#game[data-modal-open] canvas { position: relative; z-index: 2; }
#game-loading > .${PROGRESS_BAR_CLASS} {
  position: absolute; ${px(layout.frame)} background: ${colour(style.frame)};
}
#game-loading > .${PROGRESS_BAR_CLASS} {
  ${timingProperties}
}
#game-loading > .${PROGRESS_BAR_CLASS} > div { position: absolute; }
#game-loading > .${PROGRESS_BAR_CLASS} > :first-child {
  ${px(layout.track)} background: ${colour(style.track)};
}
#game-loading .${PROGRESS_BAR_BAND_CLASS} { overflow: hidden; }
#game-loading .${PROGRESS_BAR_BAND_CLASS} > * { height: 100%; }
${layout.fills
  .map(
    (fill, index) => `#game-loading > .${PROGRESS_BAR_CLASS} > :nth-child(${index + 2}) {
  ${px(fill)}
}
#game-loading > .${PROGRESS_BAR_CLASS} > :nth-child(${index + 2}) > * {
  background: ${colour(style.fills[index]!)};
}`,
  )
  .join("\n")}
`;
const CSS_FILE = `assets/loading-${createHash("sha256").update(LOADING_CSS).digest("hex").slice(0, 8)}.css`;

// Initial HTML is the kit's pending bar at the same geometry as the DOM adapter, with no script
// or style inline.
export function loadingHtml(html: string): string {
  if (!html.includes("%GAME_LOADING%")) {
    return html;
  }
  const bands = layout.fills
    .map(() => `<div class="${PROGRESS_BAR_BAND_CLASS}"><div></div></div>`)
    .join("");
  return html
    .replace("</head>", `<link rel="stylesheet" href="/${CSS_FILE}" /></head>`)
    .replace(
      "%GAME_LOADING%",
      [
        `<div id="game-loading"><div class="${PROGRESS_BAR_CLASS}" data-state="pending"`,
        'role="progressbar" aria-labelledby="game" aria-valuemin="0"',
        `aria-valuemax="1"><div></div>${bands}</div></div>`,
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
