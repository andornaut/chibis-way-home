// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { MAP_LAYOUT } from "../../data/layout.ts";
import { MAP_SCREEN } from "../layout/mapScreen.ts";
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
