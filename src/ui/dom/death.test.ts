// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { createDeathCard } from "./death";
import deathCss from "./death.css?raw";
import { createUiLayer, UI_LAYOUT } from "./layer";
import runStatsCss from "./runStats.css?raw";
import { UI_COLOURS, UI_FRAMES } from "./skin";

// Every custom property the death card's and the run statistics' stylesheets read is one the
// layer, its view bridge, the skin, the card's own elements or the stylesheets set, so no rule
// reads a value nothing provides.
it("reads only custom properties the layer, the skin, the card or the stylesheets set", () => {
  const css = `${deathCss}\n${runStatsCss}`;
  const read = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name!));
  const set = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name!));
  const card = createDeathCard(document, {
    actions: [{ key: "retry", label: "Try again" }],
    label: "Card",
    progress: "Progress",
    stage: "Stage",
    stats: [{ label: "Attempts:", value: "1" }],
    title: "Zone",
    totals: [{ label: "Run total:", value: "0:01" }],
  });
  const written = [
    card.root,
    ...card.root.querySelectorAll<HTMLElement>("[style]"),
    createUiLayer([], document).element,
  ].flatMap(({ style }) => [...Array(style.length).keys()].map((index) => style.item(index)));
  const provided = (name: string) =>
    set.has(name) ||
    written.includes(name) ||
    name in UI_LAYOUT ||
    /^--ui-(unit|view-\w+|slice-\d+)$/.test(name) ||
    // ui.css sets these on the card's action row.
    ["--half-gap", "--hit"].includes(name) ||
    UI_COLOURS.some((colour) => name === `--colour-${colour}`) ||
    UI_FRAMES.some(({ name: frame }) =>
      ["border", "bottom", "image", "left", "right", "slice", "top"].some(
        (part) => name === `--${frame}-${part}`,
      ),
    );
  expect([...read].filter((name) => !provided(name))).toEqual([]);
});
