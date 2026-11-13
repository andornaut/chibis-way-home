// @vitest-environment happy-dom
import { MAX_RENDER_SCALE, renderFit, renderScale } from "@andornaut/game-kit/view/renderScale";
import { expect, it } from "vitest";

import { MAP_LAYOUT } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { MAP_SCREEN } from "../layout/mapScreen.ts";
import { playView } from "../layout/playView.ts";
import { createUiLayer } from "./layer.ts";
import { createMap, type DestinationLook } from "./map.ts";

it("names every destination and describes its availability without adding nodes to Tab navigation", () => {
  const states: Record<DestinationLook, string> = {
    current: "Here",
    locked: "Locked",
    normal: "Available",
    unbuilt: "Unavailable",
    visited: "Completed",
  };
  const view = createMap(
    document,
    { continue: "Continue", home: "Title", states, title: "Map" },
    Object.keys(states).map((state) => ({
      centre: { x: 100, y: 100 },
      id: state,
      name: `Zone ${state}`,
      state: state as DestinationLook,
    })),
  );
  for (const [state, button] of view.destinations) {
    expect(button.getAttribute("aria-label")).toBe(`Zone ${state}`);
    expect(
      view.root.querySelector(`#${button.getAttribute("aria-describedby")}`)?.textContent,
    ).toBe(states[state as DestinationLook]);
    expect(button.tabIndex).toBe(-1);
    expect(button.getAttribute("aria-disabled")).toBe(
      ["locked", "unbuilt"].includes(state) ? "true" : null,
    );
  }
  expect(view.destinations.get("current")!.getAttribute("aria-current")).toBe("location");
  expect(view.markers.get("normal")!.alt).toBe("");
  expect([...view.root.querySelectorAll("button")].slice(0, 2)).toEqual([
    view.buttons.continue,
    view.buttons.home,
  ]);
});

it("keeps marker, label and footer press geometry independent", () => {
  const view = createMap(
    document,
    {
      continue: "Continue",
      home: "Title",
      states: {
        current: "Here",
        locked: "Locked",
        normal: "Available",
        unbuilt: "Unavailable",
        visited: "Completed",
      },
      title: "Map",
    },
    [{ centre: { x: 100, y: 100 }, id: "zone", name: "Zone", state: "normal" }],
  );
  const node = view.destinations.get("zone")!;
  expect(Number(node.style.getPropertyValue("--map-width"))).toBe(MAP_SCREEN.nodeHit.width);
  expect(Number(node.style.getPropertyValue("--map-x"))).toBe(100 - MAP_SCREEN.nodeHit.width / 2);
  const label = view.root.querySelector<HTMLElement>(".map-label")!;
  expect(Number(label.style.getPropertyValue("--map-width"))).toBe(MAP_LAYOUT.label.width);
  expect(label.closest("button")).toBeNull();
  expect(Number(view.buttons.continue.style.getPropertyValue("--map-x"))).toBe(
    MAP_SCREEN.continue.hit.x,
  );
});

it("keeps the fitted play view inside the full-layer scene root across refits", () => {
  const map = createMap(
    document,
    {
      continue: "Continue",
      home: "Title",
      states: {
        current: "Here",
        locked: "Locked",
        normal: "Available",
        unbuilt: "Unavailable",
        visited: "Completed",
      },
      title: "Map",
    },
    [],
  );
  const layer = createUiLayer([], document);
  const unmount = layer.mount(0, map.root);
  expect(map.root.classList.contains("ui-scene")).toBe(true);
  expect(map.root.classList.contains("ui-view")).toBe(false);
  expect(map.view.parentElement).toBe(map.root);
  expect(map.view.classList.contains("ui-scene")).toBe(false);
  expect(map.view.classList.contains("ui-view")).toBe(true);
  expect(map.view.querySelector(".map-content")?.parentElement).toBe(map.view);
  for (const size of [
    { height: 390, width: 844 },
    { height: 640, width: 1280 },
  ]) {
    const fit = renderFit(SCREEN, renderScale(MAX_RENDER_SCALE, 1), size);
    const play = playView(fit);
    layer.fit({ x: 17, y: 29 }, fit);
    expect(layer.element.style.getPropertyValue("--ui-view-left")).toBe(`${17 + play.x / fit.r}px`);
    expect(layer.element.style.getPropertyValue("--ui-view-top")).toBe(`${29 + play.y / fit.r}px`);
    expect(map.view.parentElement).toBe(map.root);
  }
  unmount();
  layer.dispose();
});
