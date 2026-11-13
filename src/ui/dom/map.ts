import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";

import { MAP_LAYOUT } from "../../data/layout.ts";
import type { Point, Rect } from "../../data/types/index.ts";
import type { MapAction } from "../input/mapInput.ts";
import { MAP_SCREEN } from "../layout/mapScreen.ts";
import { textButton } from "./card.ts";

export type DestinationLook = "current" | "locked" | "normal" | "unbuilt" | "visited";

export interface MapFace {
  readonly centre: Point;
  readonly id: string;
  readonly name: string;
  readonly state: DestinationLook;
}

export interface MapWords {
  readonly continue: string;
  readonly home: string;
  readonly states: Readonly<Record<DestinationLook, string>>;
  readonly title: string;
}

export interface MapView {
  readonly buttons: Readonly<Record<MapAction, HTMLButtonElement>>;
  readonly destinations: ReadonlyMap<string, HTMLButtonElement>;
  readonly markers: ReadonlyMap<string, HTMLImageElement>;
  readonly root: HTMLElement;
  readonly view: HTMLElement;
}

export const MAP_PROPERTIES = {
  "--map-bird-height": 0,
  "--map-bird-image": "none",
  "--map-bird-width": 0,
  "--map-bird-x": 0,
  "--map-bird-y": 0,
  "--map-face-width": 0,
  "--map-face-x": 0,
  "--map-face-y": 0,
  "--map-height": 0,
  "--map-miniature-height": 0,
  "--map-miniature-image": "none",
  "--map-miniature-width": 0,
  "--map-miniature-x": 0,
  "--map-miniature-y": 0,
  "--map-width": 0,
  "--map-x": 0,
  "--map-y": 0,
};

function box(rect: Rect, element: HTMLElement): void {
  writeLayoutProperties(
    {
      "--map-height": rect.height,
      "--map-width": rect.width,
      "--map-x": rect.x,
      "--map-y": rect.y,
    },
    element,
  );
}

// Marker press areas keep their canvas geometry. Names remain separate from those press areas.
export function createMap(document: Document, words: MapWords, faces: readonly MapFace[]): MapView {
  const root = document.createElement("section");
  root.className = "map-scene";
  const view = document.createElement("div");
  view.className = "ui-view map-view";
  writeLayoutProperties(MAP_PROPERTIES, view);
  root.append(view);
  root.setAttribute("aria-labelledby", "map-title");
  const content = document.createElement("div");
  content.className = "map-content";
  view.append(content);
  const title = document.createElement("h1");
  title.id = "map-title";
  title.className = "map-title";
  title.textContent = words.title;
  writeLayoutProperties({ "--map-x": MAP_SCREEN.title.x, "--map-y": MAP_SCREEN.title.y }, title);
  content.append(title);
  const buttons = {
    continue: textButton(document, words.continue, true),
    home: textButton(document, words.home),
  };
  for (const key of ["continue", "home"] as const) {
    const button = buttons[key];
    const { button: face, hit } = MAP_SCREEN[key];
    button.dataset.control = key;
    button.classList.add("map-action");
    box(hit, button);
    writeLayoutProperties(
      {
        "--map-face-width": face.width,
        "--map-face-x": face.x - hit.x,
        "--map-face-y": face.y - hit.y,
      },
      button,
    );
    content.append(button);
  }
  const destinations = new Map<string, HTMLButtonElement>();
  const markers = new Map<string, HTMLImageElement>();
  for (const face of faces) {
    const { centre, id, name, state } = face;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-destination ui-press";
    button.dataset.destination = id;
    button.dataset.state = state;
    button.tabIndex = -1;
    button.setAttribute("aria-label", name);
    const description = document.createElement("span");
    description.id = `map-state-${id}`;
    description.hidden = true;
    description.textContent = words.states[state];
    button.setAttribute("aria-describedby", description.id);
    if (state === "locked" || state === "unbuilt") {
      button.setAttribute("aria-disabled", "true");
    }
    if (state === "current") {
      button.setAttribute("aria-current", "location");
    }
    box(
      {
        ...MAP_SCREEN.nodeHit,
        x: centre.x - MAP_SCREEN.nodeHit.width / 2,
        y: centre.y - MAP_SCREEN.nodeHit.height / 2,
      },
      button,
    );
    const marker = document.createElement("img");
    marker.className = "map-marker";
    marker.alt = "";
    marker.draggable = false;
    box(
      {
        height: MAP_LAYOUT.zoneMarker,
        width: MAP_LAYOUT.zoneMarker,
        x: centre.x + MAP_SCREEN.marker.zone.x - (centre.x - MAP_SCREEN.nodeHit.width / 2),
        y: centre.y + MAP_SCREEN.marker.zone.y - (centre.y - MAP_SCREEN.nodeHit.height / 2),
      },
      marker,
    );
    button.append(marker, description);
    const label = document.createElement("p");
    label.className = "map-label";
    label.textContent = name;
    label.setAttribute("aria-hidden", "true");
    box(
      {
        height: MAP_LAYOUT.label.height,
        width: MAP_LAYOUT.label.width,
        x: centre.x - MAP_LAYOUT.label.width / 2,
        y: centre.y + MAP_LAYOUT.label.top,
      },
      label,
    );
    content.append(button, label);
    destinations.set(id, button);
    markers.set(id, marker);
  }
  return { buttons, destinations, markers, root, view };
}
