// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { expect, it } from "vitest";

import { TEXT } from "../../data/text.ts";
import { createChoiceCard } from "./choice.ts";
import { createDeathCard } from "./death.ts";
import { createDialogueView } from "./dialogue.ts";
import { createUiLayer, UI_LAYOUT } from "./layer.ts";
import { UI_COLOURS, UI_FRAMES } from "./skin.ts";
// Vitest blanks CSS imports, so these contracts read the actual stylesheets.
const deathCss = readFileSync(createRequire(import.meta.url).resolve("./death.css"), "utf8");
const runStatsCss = readFileSync(createRequire(import.meta.url).resolve("./runStats.css"), "utf8");
const uiCss = readFileSync(createRequire(import.meta.url).resolve("./ui.css"), "utf8");

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

// Happy DOM checks the actual group/CSS contract, not physical viewport measurements.
function footerStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  const kit = readFileSync(
    createRequire(import.meta.url).resolve("@andornaut/game-kit/web/ui/dom/controls.css"),
    "utf8",
  );
  style.textContent = [kit, uiCss, deathCss].join("\n");
  document.head.append(style);
  return style;
}

it("lays out the final retry footer as equal horizontal tracks with the primary on the right", () => {
  const style = footerStyles();
  const card = createDeathCard(document, {
    actions: [
      { key: "retry", label: TEXT.death.retry },
      { key: "home", label: TEXT.pause.home },
    ],
    label: TEXT.death.label,
    progress: TEXT.death.progress,
    stage: TEXT.death.stage,
    stats: [],
    title: TEXT.death.title,
    totals: [],
  });
  document.body.append(card.root);
  try {
    const actions = card.dialog.lastElementChild as HTMLElement;
    expect(actions.classList.contains("ui-control-group")).toBe(true);
    expect(actions.dataset.uiAxis).toBe("row");
    const group = getComputedStyle(actions);
    expect(group.display).toBe("inline-grid");
    expect(group.gridAutoFlow).toBe("column");
    expect(group.gridAutoColumns).toBe("1fr");
    expect([...actions.children]).toEqual([card.buttons.retry, card.buttons.home]);
    expect(card.buttons.retry.classList.contains("ui-text-button-primary")).toBe(true);
    expect(card.buttons.home.classList.contains("ui-text-button-primary")).toBe(false);
    // Pair the actual primary-first DOM with the shared visual placement declarations.
    const rules = [...uiCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const placement = rules.filter(([, selector]) =>
      selector!.trim().startsWith(".ui-card-actions:not(:where(.ui-button-stack))"),
    );
    expect(
      placement.map(([, , declarations]) => [
        declarations!.match(/grid-row:\s*(\d+)/)?.[1],
        declarations!.match(/grid-column:\s*(\d+)/)?.[1],
      ]),
    ).toEqual([
      ["1", "2"],
      ["1", "1"],
    ]);
    card.buttons.retry.focus();
    expect(document.activeElement).toBe(card.buttons.retry);
  } finally {
    card.root.remove();
    style.remove();
  }
});

it("keeps dialogue rows and choice stacks on the same native group geometry", () => {
  const style = footerStyles();
  const dialogue = createDialogueView(document, false, "conversation", TEXT.dialogue);
  const choice = createChoiceCard(document, "choice", {
    options: [
      { id: "continue", label: TEXT.dialogue.continue },
      { id: "skip", label: TEXT.dialogue.skip },
    ],
    prompt: TEXT.dialogue.label,
  });
  document.body.append(dialogue.root, choice.root);
  try {
    expect(dialogue.footer.dataset.uiAxis).toBe("row");
    expect(getComputedStyle(dialogue.footer).display).toBe("inline-grid");
    expect(getComputedStyle(dialogue.footer).gridAutoFlow).toBe("column");
    expect([...dialogue.footer.children]).toEqual([
      dialogue.buttons.continue,
      dialogue.buttons.skip,
    ]);
    const actions = choice.dialog.lastElementChild as HTMLElement;
    expect(actions.dataset.uiAxis).toBe("stack");
    expect(getComputedStyle(actions).display).toBe("inline-grid");
    expect(getComputedStyle(actions).gridAutoFlow).toBe("row");
    expect([...actions.children]).toEqual([...choice.buttons.values()]);
    expect([...actions.children].map((button) => button.textContent)).toEqual([
      TEXT.dialogue.continue,
      TEXT.dialogue.skip,
    ]);
  } finally {
    dialogue.root.remove();
    choice.root.remove();
    style.remove();
  }
});
