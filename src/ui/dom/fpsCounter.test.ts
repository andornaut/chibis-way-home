// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, expect, it } from "vitest";

import { TEXT } from "../../data/text.ts";
import { fpsCounterShown, setFpsCounterShown } from "../settings/fpsCounter.ts";
import { mountFpsCounter } from "./fpsCounter.ts";

// Vitest blanks CSS imports, so the page stylesheet is read from disk, from the checkout's root.
const PAGE_CSS = readFileSync(resolve("src/main.css"), "utf8");

afterEach(() => {
  setFpsCounterShown(false);
  document.body.replaceChildren();
});

// On, it sits on the page outside the game, in the original bottom-right corner.
it("is off by default, then shows the frame rate in the viewport corner above everything", () => {
  const game = document.createElement("div");
  game.id = "game";
  document.body.append(game);
  const unmount = mountFpsCounter(document, () => 59.6, TEXT.settings.fps);
  const counter = document.querySelector<HTMLElement>(".fps-counter")!;
  expect([fpsCounterShown(), counter.hidden]).toEqual([false, true]);
  setFpsCounterShown(true);
  const rule = /\n\.fps-counter \{([^}]*)\}/u.exec(PAGE_CSS)?.[1] ?? "";
  expect({
    hidden: counter.hidden,
    label: counter.getAttribute("aria-label"),
    onPage: counter.parentElement === document.body && !game.contains(counter),
    rule: [
      "position: fixed;",
      "z-index: 2147483647;",
      "right: calc(var(--inset-right) + 8px);",
      "bottom: calc(var(--inset-bottom) + 8px);",
      "pointer-events: none;",
    ].filter((declaration) => !rule.includes(declaration)),
    text: counter.textContent,
  }).toEqual({ hidden: false, label: TEXT.settings.fps, onPage: true, rule: [], text: "60" });
  expect(rule).not.toContain("top:");
  expect(PAGE_CSS.match(/\.fps-counter\s*\{/gu)).toHaveLength(1);
  unmount();
  expect(document.querySelector(".fps-counter")).toBeNull();
});
