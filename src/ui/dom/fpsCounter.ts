import { writeLayoutProperties } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import palette from "../../../public/art/palette.json" with { type: "json" };
import { UI_FONT_FAMILY } from "../chrome/uiFonts.ts";
import { fpsCounterShown, watchFpsCounter } from "../settings/fpsCounter.ts";
import { setThemeText, textRole } from "./theme.ts";

// How often the counter shows the latest reading.
const REFRESH_MS = 500;

// The palette colours main.css paints the counter in, as the UI layer names them.
const { cream, ink } = palette.colours;

// The FPS counter: a page-level element on <body>, outside the game's view, which main.css fixes
// in the device viewport's bottom-right corner inside the safe area, above everything including
// the letterbox bars. It shows fps(), rounded, while the FPS counter setting is on, named by
// label. Its text is the interface's label role in the UI font and the palette's colours; as it
// is outside the UI layer, it carries those tokens itself and its unit is one CSS px. Returns its
// removal.
export function mountFpsCounter(document: Document, fps: () => number, label: string): () => void {
  const counter = document.createElement("output");
  counter.className = `fps-counter ${textRole("label")}`;
  setThemeText(counter);
  writeLayoutProperties(
    {
      "--colour-cream": cream,
      "--colour-ink": ink,
      "--ui-font-family": JSON.stringify(UI_FONT_FAMILY),
    },
    counter,
  );
  counter.setAttribute("aria-label", label);
  document.body.append(counter);
  const page = document.defaultView!;
  let timer: number | undefined;
  const show = (on: boolean) => {
    counter.hidden = !on;
    if (on && timer === undefined) {
      const refresh = () => {
        counter.textContent = String(Math.round(fps()));
      };
      refresh();
      timer = page.setInterval(refresh, REFRESH_MS);
    } else if (!on && timer !== undefined) {
      page.clearInterval(timer);
      timer = undefined;
    }
  };
  show(fpsCounterShown());
  const unwatch = watchFpsCounter(show);
  return () => {
    unwatch();
    show(false);
    counter.remove();
  };
}
