import { fpsCounterShown, watchFpsCounter } from "../settings/fpsCounter.ts";

// How often the counter shows the latest reading.
const REFRESH_MS = 500;

// The FPS counter: a page-level element on <body>, outside the game's view, which main.css fixes
// in the device viewport's top-right corner inside the safe area, above everything including
// the letterbox bars. It shows fps(), rounded, while the FPS counter setting is on, named by
// label. Returns its removal.
export function mountFpsCounter(document: Document, fps: () => number, label: string): () => void {
  const counter = document.createElement("output");
  counter.className = "fps-counter";
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
