// @vitest-environment happy-dom
import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ Core: {}, Scale: {} }));

import { createUiLayer } from "../ui/index.ts";
import { revealSceneView } from "./domUi.ts";

function pending() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
afterEach(() => {
  vi.restoreAllMocks();
  if (originalFonts === undefined) {
    Reflect.deleteProperty(document, "fonts");
  } else {
    Object.defineProperty(document, "fonts", originalFonts);
  }
});

function fixture() {
  const font = pending();
  const image = pending();
  const decode = vi.spyOn(HTMLImageElement.prototype, "decode").mockReturnValue(image.promise);
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load: () => font.promise },
  });
  const events = new EventEmitter();
  const scene = { events, game: {} } as unknown as Scene;
  const view = document.createElement("div");
  return { decode, events, font, image, scene, view };
}

it("keeps a scene noninteractive until its fonts and images settle before handing off once", async () => {
  const { decode, events, font, image, scene, view } = fixture();
  const reveal = revealSceneView(scene, view, ["blob:logo"]);
  const handoff = vi.fn();
  void reveal.revealed.then(handoff);
  expect([view.inert, view.hasAttribute("data-ui-unready")]).toEqual([false, true]);
  font.resolve();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(decode).toHaveBeenCalledOnce();
  expect(handoff).not.toHaveBeenCalled();
  image.resolve();
  await expect(reveal.revealed).resolves.toBe(true);
  expect([view.inert, view.hasAttribute("data-ui-unready"), view.hidden]).toEqual([
    false,
    false,
    false,
  ]);
  expect(handoff).toHaveBeenCalledExactlyOnceWith(true);
  events.emit("shutdown");
});

it("cancels on shutdown without revealing or enabling the obsolete scene after images settle", async () => {
  const { events, font, image, scene, view } = fixture();
  const reveal = revealSceneView(scene, view, Promise.resolve(["blob:portrait"]));
  view.inert = true;
  view.hidden = true;
  events.emit("shutdown");
  await expect(reveal.revealed).resolves.toBe(false);
  font.resolve();
  image.resolve();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  expect([view.inert, view.hidden, events.listenerCount("shutdown")]).toEqual([true, true, 0]);
});

it("leaves an intervening modal's inert state and its controller's visibility unchanged", async () => {
  const { events, font, image, scene, view } = fixture();
  const reveal = revealSceneView(scene, view, ["blob:logo"]);
  const layer = createUiLayer([], document);
  document.body.append(layer.element);
  layer.mount(0, view);
  const cover = document.createElement("div");
  const dialog = document.createElement("section");
  cover.append(dialog);
  layer.mount(1, cover);
  const close = layer.modals.open({}, dialog);
  view.hidden = true;
  expect(view.inert).toBe(true);
  font.resolve();
  image.resolve();
  await expect(reveal.revealed).resolves.toBe(true);
  expect([view.inert, view.hidden, view.hasAttribute("data-ui-unready")]).toEqual([
    true,
    true,
    false,
  ]);
  close();
  expect([view.inert, view.hidden]).toEqual([false, true]);
  events.emit("shutdown");
  layer.dispose();
});
