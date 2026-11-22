// @vitest-environment happy-dom
import { expect, it } from "vitest";

import palette from "../../../public/art/palette.json" with { type: "json" };
import { TEXT } from "../../data/text.ts";
import { startScreenLayout } from "../layout/startScreen.ts";
import { createStart } from "./start.ts";

const colour = (name: keyof typeof palette.colours) =>
  Number.parseInt(palette.colours[name].slice(1), 16);
const colours = {
  cream: colour("cream"),
  dslate: colour("dslate"),
  ink: colour("ink"),
  navy: colour("navy"),
  white: colour("white"),
};

it.each([false, true])(
  "keeps Start's native control names, geometry and keyboard order with saved=%s",
  (saved) => {
    const layout = startScreenLayout({ height: 239, width: 558 }, true, saved);
    const view = createStart(document, colours, TEXT.start, layout);
    expect(
      view.buttons
        .get("start")!
        .querySelector(".ui-text-button-face")!
        .hasAttribute("data-ui-authored-size"),
    ).toBe(false);
    expect([...view.buttons.keys()]).toEqual(["start", ...(saved ? ["restart"] : []), "exit"]);
    expect(view.buttons.get("start")!.textContent).toBe(
      saved ? TEXT.start.continue : TEXT.start.start,
    );
    for (const control of ["exit"] as const) {
      const button = view.buttons.get(control)!;
      expect(button.getAttribute("aria-label")).toBe(TEXT.start[control]);
      expect(Number(button.style.getPropertyValue("--start-x"))).toBe(layout[control]!.hit.x);
    }
    expect(view.root.getAttribute("role")).toBe("region");
    expect(view.root.getAttribute("aria-label")).toBe(TEXT.start.name);
    expect(view.logo.alt).toBe(TEXT.start.logo);
    const start = view.buttons.get("start")!;
    expect(start.classList.contains("ui-anchored-action")).toBe(true);
    expect(Number(start.parentElement!.style.getPropertyValue("--ui-action-y"))).toBe(
      layout.actionY,
    );
    expect(view.buttons.has("restart")).toBe(saved);
    const icon = view.buttons.get("exit")!.querySelector("svg.navigation-disc")!;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("viewBox")).toBe("0 0 35 35");
    expect(
      [...icon.querySelectorAll("circle")].map((circle) => [
        circle.getAttribute("cx"),
        circle.getAttribute("cy"),
        circle.getAttribute("r"),
        circle.dataset.uiFill,
      ]),
    ).toEqual([
      ["17.5", "17.5", "16.5", "ink"],
      ["17.5", "17.5", "15.5", "cream"],
      ["17.5", "17.5", "13.5", "navy"],
    ]);
    expect(icon.querySelector("path")!.getAttribute("transform")).toBe("translate(8.6 7.5)");
    expect(view.buttons.get("exit")!.querySelector("img")).toBeNull();
    expect(Number(view.logo.style.getPropertyValue("--start-width"))).toBe(layout.logo.width);
  },
);

it("omits Exit and Restart when the installed window has no exit and there is no saved progress", () => {
  const view = createStart(
    document,
    colours,
    TEXT.start,
    startScreenLayout({ height: 239, width: 558 }, false, false),
  );
  expect([...view.buttons.keys()]).toEqual(["start"]);
  expect(view.buttons.get("start")!.classList.contains("ui-text-button-primary")).toBe(true);
});

it("uses fresh production controls and image slots for authoring while retaining conditional order", () => {
  const layout = startScreenLayout({ height: 239, width: 558 }, true, true);
  const live = createStart(document, colours, TEXT.start, layout);
  document.body.append(live.root);
  live.logo.src = "blob:runtime-logo";
  const authored = createStart(document, colours, TEXT.start, layout);
  expect([...authored.buttons.keys()]).toEqual([...live.buttons.keys()]);
  expect(authored.buttons.get("start")).not.toBe(live.buttons.get("start"));
  expect(authored.logo.getAttribute("src")).toBeNull();
  expect(authored.root.children).toHaveLength(1);
  live.root.remove();
});
