// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { MAX_RENDER_SCALE, renderFit, renderScale } from "@andornaut/game-kit/view/renderScale";
import { describe, expect, it } from "vitest";

import { SCREEN } from "../../data/screen";
import { playView } from "../layout/playView";
import { createUiLayer, UI_LAYOUT } from "./layer";
import { UI_COLOURS, UI_FRAMES } from "./skin";

// Vitest blanks CSS imports, so the stylesheet is read from disk, from the project root.
const css = readFileSync("src/ui/dom/ui.css", "utf8");
// The kit's ui.css, which loads first, sets the shared button gaps.
const kitCss = readFileSync(
  createRequire(import.meta.url).resolve("@andornaut/game-kit/web/ui/dom/ui.css"),
  "utf8",
);

const property = (element: HTMLElement, name: string) => element.style.getPropertyValue(name);

describe("the UI layer", () => {
  it("writes every layout value as a custom property, numbers unitless", () => {
    const { element } = createUiLayer([], document);
    expect(Object.keys(UI_LAYOUT).map((name) => property(element, name))).toEqual(
      Object.values(UI_LAYOUT).map(String),
    );
  });

  it.each([
    [{ height: 390, width: 844 }, 3, { x: 0, y: 0 }],
    [{ height: 640, width: 1280 }, 1, { x: 2, y: 0 }],
  ])("puts the view on the play view of a %o canvas at DPR %d", (size, dpr, canvasAt) => {
    const fit = renderFit(SCREEN, renderScale(MAX_RENDER_SCALE, dpr), size);
    const view = playView(fit);
    const layer = createUiLayer([2], document);
    layer.fit(canvasAt, fit);
    expect({
      height: property(layer.element, "--ui-view-height"),
      left: property(layer.element, "--ui-view-left"),
      slice: property(layer.element, "--ui-slice-2"),
      top: property(layer.element, "--ui-view-top"),
      unit: property(layer.element, "--ui-unit"),
      width: property(layer.element, "--ui-view-width"),
    }).toEqual({
      height: `${view.height / fit.r}px`,
      left: `${canvasAt.x + view.x / fit.r}px`,
      slice: `${Math.max(1, Math.round(2 * fit.fit))}px`,
      top: `${canvasAt.y + view.y / fit.r}px`,
      unit: String(fit.fit),
      width: `${view.width / fit.r}px`,
    });
  });

  it("stacks scene views by their order in the scene list", () => {
    const layer = createUiLayer([], document);
    const view = (order: number) => {
      const element = document.createElement("div");
      element.id = `scene-${order}`;
      return { element, unmount: layer.mount(order, element) };
    };
    const [, , middle] = [view(17), view(3), view(9)];
    expect([...layer.element.children].map(({ id }) => id)).toEqual([
      "scene-3",
      "scene-9",
      "scene-17",
    ]);
    middle.unmount();
    expect([...layer.element.children].map(({ id }) => id)).toEqual(["scene-3", "scene-17"]);
  });
});

// Every custom property ui.css reads is one the layer, its view bridge or the skin writes, or one
// the stylesheet or the kit's sets, so no rule reads a value nothing provides.
it("reads only custom properties the layer, the bridge, the skin or a stylesheet set", () => {
  const read = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name!));
  const set = new Set([...`${kitCss}${css}`.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name!));
  const layer = createUiLayer([2, 4, 6], document);
  const written = new Set(Object.keys(UI_LAYOUT));
  const provided = (name: string) =>
    set.has(name) ||
    written.has(name) ||
    property(layer.element, name) !== "" ||
    /^--ui-(unit|view-\w+|slice-\d+)$/.test(name) ||
    UI_COLOURS.some((colour) => name === `--colour-${colour}`) ||
    UI_FRAMES.some(({ name: frame }) =>
      ["border", "bottom", "image", "left", "right", "slice", "top"].some(
        (part) => name === `--${frame}-${part}`,
      ),
    );
  expect([...read].filter((name) => !provided(name))).toEqual([]);
});
