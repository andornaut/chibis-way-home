// @vitest-environment happy-dom
import { ACTION_GAPS, arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import { expect, it } from "vitest";

import { MAP_LAYOUT, TEXT_BUTTON } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { TEXT } from "../../data/text.ts";
import { hitMargin } from "../layout/hitAreas.ts";
import { MAP_SCREEN } from "../layout/mapScreen.ts";
import { actionRole } from "./actions.ts";
import { createMap, type DestinationLook, type MapFace } from "./map.ts";

const WORDS = {
  continue: TEXT.map.continue,
  home: TEXT.pause.home,
  states: TEXT.map.destinationStates,
  title: TEXT.map.title,
};
const LOOKS = Object.keys(TEXT.map.destinationStates) as DestinationLook[];
const NAMES = Object.values(TEXT.map.zones);
// One destination in each state, named from the zone names.
const FACES: MapFace[] = LOOKS.map((state, index) => ({
  centre: { x: 100 + 100 * index, y: 100 },
  id: state,
  name: NAMES[index % NAMES.length]!,
  state,
}));
const face = (width: number) => ({ height: TEXT_BUTTON.height, width });
const number = (name: string, element: HTMLElement) => Number(element.style.getPropertyValue(name));

it("names the Map by its title and its footer actions from the text data", () => {
  const view = createMap(document, WORDS, FACES);
  const title = view.root.querySelector(`#${view.root.getAttribute("aria-labelledby")}`)!;
  expect(title.tagName).toBe("H1");
  expect(title.textContent).toBe(TEXT.map.title);
  expect(view.buttons.continue.textContent).toBe(TEXT.map.continue);
  expect(view.buttons.home.textContent).toBe(TEXT.pause.home);
  expect(actionRole(view.buttons.continue)).toBe("primary");
  expect(actionRole(view.buttons.home)).toBe("secondary");
  for (const [control, button] of Object.entries(view.buttons)) {
    expect(button.dataset.control).toBe(control);
    expect(button.disabled).toBe(false);
    expect(button.hidden).toBe(false);
  }
});

it("moves the Tab focus from Continue to Back to title and never to a destination", () => {
  const view = createMap(document, WORDS, FACES);
  const buttons = [...view.root.querySelectorAll("button")];
  expect(buttons.filter((button) => button.tabIndex >= 0)).toEqual([
    view.buttons.continue,
    view.buttons.home,
  ]);
  expect(buttons.slice(2)).toEqual([...view.destinations.values()]);
});

it("names every destination and describes its state", () => {
  const view = createMap(document, WORDS, FACES);
  expect([...view.destinations.keys()]).toEqual(LOOKS);
  for (const { id, name, state } of FACES) {
    const button = view.destinations.get(id)!;
    expect(button.getAttribute("aria-label")).toBe(name);
    const description = view.root.querySelector<HTMLElement>(
      `#${button.getAttribute("aria-describedby")}`,
    )!;
    expect(description.textContent).toBe(TEXT.map.destinationStates[state]);
    expect(description.hidden).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe(
      state === "locked" || state === "unbuilt" ? "true" : null,
    );
    expect(button.getAttribute("aria-current")).toBe(state === "current" ? "location" : null);
    expect(button.dataset.state).toBe(state);
    expect(view.markers.get(id)!.alt).toBe("");
    expect(button.contains(view.markers.get(id)!)).toBe(true);
  }
});

it("shows each name once, outside its destination's press area and hidden from its accessible name", () => {
  const view = createMap(document, WORDS, FACES);
  const labels = [...view.root.querySelectorAll<HTMLElement>("p")];
  expect(labels.map((label) => label.textContent)).toEqual(FACES.map(({ name }) => name));
  for (const [index, label] of labels.entries()) {
    expect(label.getAttribute("aria-hidden")).toBe("true");
    expect(label.closest("button")).toBeNull();
    // The label follows its destination, whose focus and press it shows.
    expect(label.previousElementSibling).toBe(view.destinations.get(FACES[index]!.id));
  }
});

it("places each destination's press area and name from the map's geometry", () => {
  const view = createMap(document, WORDS, FACES);
  for (const { centre, id } of FACES) {
    const button = view.destinations.get(id)!;
    expect(number("--map-width", button)).toBe(MAP_SCREEN.nodeHit.width);
    expect(number("--map-height", button)).toBe(MAP_SCREEN.nodeHit.height);
    expect(number("--map-x", button) + MAP_SCREEN.nodeHit.width / 2).toBe(centre.x);
    expect(number("--map-y", button) + MAP_SCREEN.nodeHit.height / 2).toBe(centre.y);
    const marker = view.markers.get(id)!;
    expect(number("--map-x", button) + number("--map-x", marker)).toBe(
      centre.x + MAP_SCREEN.marker.zone.x,
    );
    const label = button.nextElementSibling as HTMLElement;
    expect(number("--map-x", label) + number("--map-width", label) / 2).toBe(centre.x);
    expect(number("--map-y", label)).toBe(centre.y + MAP_LAYOUT.label.top);
  }
  const title = view.root.querySelector<HTMLElement>("h1")!;
  expect(number("--map-x", title) + number("--map-title-width", title) / 2).toBe(SCREEN.width / 2);
  expect(number("--map-y", title)).toBe(MAP_SCREEN.title.y);
  expect(number("--map-action-y", view.view)).toBe(MAP_SCREEN.actionY);
});

it("shows Back to title on the left and Continue on the right, 16 px apart, centred as a pair", () => {
  const gap = ACTION_GAPS.standard.row;
  const margin = hitMargin({ ...face(TEXT_BUTTON.height), x: 0, y: 0 });
  expect(gap).toBe(TEXT_BUTTON.gap);
  // Focus order: Continue, then Back to title.
  const arrangement = arrangeActions({ width: SCREEN.width }, [
    { key: "continue", role: "primary", size: face(128) },
    { key: "home", role: "secondary", size: face(160) },
  ]);
  expect(arrangement.axis).toBe("row");
  const placed = Object.fromEntries(
    arrangement.actions.map((action) => [action.key, action] as const),
  );
  const left = (SCREEN.width - (160 + gap + 128)) / 2;
  expect(placed.home).toMatchObject({
    face: { ...face(160), x: left, y: 0 },
    outset: { left: margin, right: gap / 2 },
  });
  expect(placed.continue).toMatchObject({
    face: { ...face(128), x: left + 160 + gap, y: 0 },
    outset: { left: gap / 2, right: margin },
  });
});
