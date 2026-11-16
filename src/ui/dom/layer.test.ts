// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  MAX_RENDER_SCALE,
  renderFit,
  renderScale,
} from "@andornaut/game-kit/runtime/view/renderScale";
import { describe, expect, it } from "vitest";

import { SCREEN } from "../../data/screen.ts";
import { playView } from "../layout/playView.ts";
import { createUiLayer, UI_LAYOUT } from "./layer.ts";
import { UI_COLOURS, UI_FRAMES } from "./skin.ts";

// Vitest blanks CSS imports, so the stylesheet is read from disk, from the project root.
const css = readFileSync("src/ui/dom/ui.css", "utf8");
// The kit's ui.css, which loads first, sets the shared button gaps.
const kitCss = readFileSync(
  createRequire(import.meta.url).resolve("@andornaut/game-kit/runtime/web/ui/dom/ui.css"),
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
    expect(
      [...layer.element.children]
        .filter((child) => !child.classList.contains("global-menu-layer"))
        .map(({ id }) => id),
    ).toEqual(["scene-3", "scene-9", "scene-17"]);
    middle.unmount();
    expect(
      [...layer.element.children]
        .filter((child) => !child.classList.contains("global-menu-layer"))
        .map(({ id }) => id),
    ).toEqual(["scene-3", "scene-17"]);
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

it("covers the global entry only while a physical modal is open, ignoring entry live requests", () => {
  const layer = createUiLayer([], document);
  document.body.append(layer.element);
  const dialog = document.createElement("section"),
    first = document.createElement("button"),
    entry = document.createElement("button");
  dialog.tabIndex = -1;
  dialog.append(first);
  layer.mount(0, dialog);
  const remove = layer.menuEntry(entry);
  entry.focus();
  expect(document.activeElement).toBe(entry);
  expect(entry.closest("[inert], [data-ui-dimmed]")).toBeNull();
  const close = layer.modals.open({ live: [entry] }, dialog);
  expect(entry.closest("[inert]")).not.toBeNull();
  expect(entry.closest("[data-ui-dimmed]")).not.toBeNull();
  const tab = () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" }),
    );
  tab();
  expect(document.activeElement).toBe(first);
  tab();
  expect(document.activeElement).toBe(first);
  tab();
  expect(document.activeElement).toBe(first);
  close();
  expect(entry.closest("[inert], [data-ui-dimmed]")).toBeNull();
  entry.focus();
  expect(document.activeElement).toBe(entry);
  remove();
  expect(entry.isConnected).toBe(false);
  layer.dispose();
});

it("keeps a late ordinary Menu entry covered and removes the exact registration", () => {
  const layer = createUiLayer([], document);
  document.body.append(layer.element);
  const dialog = document.createElement("section");
  dialog.tabIndex = -1;
  layer.mount(0, dialog);
  const close = layer.modals.open({}, dialog);
  const entry = document.createElement("button"),
    remove = layer.menuEntry(entry);
  expect(entry.closest("[inert]")).not.toBeNull();
  expect(() => layer.menuEntry(document.createElement("button"))).toThrow("already registered");
  remove();
  expect(entry.isConnected).toBe(false);
  close();
  layer.dispose();
});

it("keeps the global entry covered through nested physical modals and restores it after both close", () => {
  const layer = createUiLayer([], document);
  document.body.append(layer.element);
  const entry = document.createElement("button");
  layer.menuEntry(entry);
  const conversation = document.createElement("section");
  layer.mount(0, conversation);
  const closeConversation = layer.modals.open({ live: [entry] }, conversation);
  const entryLayer = entry.closest(".global-menu-layer")!;
  expect(conversation.previousElementSibling).toBe(entryLayer);
  expect(entry.closest("[inert]")).not.toBeNull();
  const dialog = document.createElement("section");
  const action = document.createElement("button");
  dialog.append(action);
  layer.mount(1, dialog);
  const close = layer.modals.open({}, dialog);
  expect(dialog.previousElementSibling).toBe(entryLayer);
  expect(entry.closest("[inert]")).not.toBeNull();
  expect(entry.closest("[data-ui-dimmed]")).not.toBeNull();
  const later = document.createElement("div");
  layer.mount(2, later);
  expect(dialog.previousElementSibling).toBe(entryLayer);
  action.focus();
  action.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" }),
  );
  expect(document.activeElement).toBe(action);
  close();
  expect(conversation.previousElementSibling).toBe(entryLayer);
  expect(entry.closest("[inert]")).not.toBeNull();
  expect(entry.closest("[data-ui-dimmed]")).not.toBeNull();
  closeConversation();
  expect(layer.element.lastElementChild).toBe(entryLayer);
  expect(entry.closest("[inert], [data-ui-dimmed]")).toBeNull();
  layer.dispose();
});

it("dims marked same-scene chrome outside the dialog and restores nested coverage", () => {
  const layer = createUiLayer([], document);
  document.body.append(layer.element);
  layer.setDimmedSkin({ "--colour-cream": "dimmed" });
  const root = document.createElement("div");
  const hud = document.createElement("div");
  hud.setAttribute("data-ui-covered", "");
  const image = document.createElement("img");
  image.src = "blob:lit";
  layer.dimImage("blob:lit", "blob:dim");
  hud.append(image);
  const dialog = document.createElement("section");
  dialog.setAttribute("data-ui-covered", "");
  const action = document.createElement("button");
  action.setAttribute("data-ui-covered", "");
  dialog.append(action);
  root.append(hud, dialog);
  layer.mount(0, root);
  const closeLive = layer.modals.open({ live: [hud] }, dialog);
  expect(hud.hasAttribute("data-ui-dimmed")).toBe(false);
  closeLive();
  const close = layer.modals.open({}, dialog);
  expect(hud.hasAttribute("data-ui-dimmed")).toBe(true);
  expect(image.getAttribute("src")).toBe("blob:dim");
  expect([dialog, action].map((element) => element.hasAttribute("data-ui-dimmed"))).toEqual([
    false,
    false,
  ]);
  const nested = document.createElement("section");
  layer.mount(1, nested);
  const closeNested = layer.modals.open({}, nested);
  expect(root.hasAttribute("data-ui-dimmed")).toBe(true);
  closeNested();
  expect(root.hasAttribute("data-ui-dimmed")).toBe(false);
  expect(hud.hasAttribute("data-ui-dimmed")).toBe(true);
  expect(hud.style.getPropertyValue("--colour-cream")).toBe("dimmed");
  expect(image.getAttribute("src")).toBe("blob:dim");
  expect([root.hidden, hud.hidden, dialog.hidden]).toEqual([false, false, false]);
  close();
  expect(hud.hasAttribute("data-ui-dimmed")).toBe(false);
  expect(image.getAttribute("src")).toBe("blob:lit");
  layer.dispose();
});
