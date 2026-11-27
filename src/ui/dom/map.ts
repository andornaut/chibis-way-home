import { controlPresentation } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { writeLayoutProperties } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { MAP_LAYOUT } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { Point, Rect } from "../../data/types/index.ts";
import type { MapAction } from "../input/mapInput.ts";
import { MAP_SCREEN } from "../layout/index.ts";
import { type ActionsView, createActions } from "./actions.ts";
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
  // The footer row: Back to title on the left and Continue on the right.
  readonly actions: ActionsView;
  readonly buttons: Readonly<Record<MapAction, HTMLButtonElement>>;
  readonly destinations: ReadonlyMap<string, HTMLButtonElement>;
  readonly letterbox: HTMLElement;
  readonly markers: ReadonlyMap<string, HTMLImageElement>;
  readonly root: HTMLElement;
  readonly view: HTMLElement;
}

export const MAP_PROPERTIES = {
  "--map-action-y": MAP_SCREEN.actionY,
  "--map-bird-height": 0,
  "--map-bird-image": "none",
  "--map-bird-width": 0,
  "--map-bird-x": 0,
  "--map-bird-y": 0,
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

// The title's box, centred on the title's x; its text is centred in it.
export const MAP_TITLE_PROPERTIES = {
  "--map-title-width": MAP_SCREEN.title.width,
  "--map-x": MAP_SCREEN.title.x - MAP_SCREEN.title.width / 2,
  "--map-y": MAP_SCREEN.title.y,
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
  const letterbox = document.createElement("div");
  letterbox.className = "map-letterbox";
  letterbox.setAttribute("aria-hidden", "true");
  const view = document.createElement("div");
  view.className = "ui-view map-view";
  writeLayoutProperties(MAP_PROPERTIES, view);
  root.setAttribute("aria-labelledby", "map-title");
  const content = document.createElement("div");
  content.className = "map-content";
  const title = document.createElement("h1");
  title.className = "map-title ui-text-heading";
  title.id = "map-title";
  title.textContent = words.title;
  writeLayoutProperties(MAP_TITLE_PROPERTIES, title);
  // Continue leads the focus order; the group shows it on the right.
  const buttons = {
    continue: textButton(document, words.continue, true),
    home: textButton(document, words.home),
  };
  buttons.continue.dataset.control = "continue";
  buttons.home.dataset.control = "home";
  const actions = createActions(document, [buttons.continue, buttons.home], {
    className: "map-actions",
    width: SCREEN.width,
  });
  content.append(title, actions.element);
  const destinations = new Map<string, HTMLButtonElement>();
  const markers = new Map<string, HTMLImageElement>();
  for (const face of faces) {
    const { centre, id, name, state } = face;
    const presentation = controlPresentation(
      state === "locked" || state === "unbuilt"
        ? { kind: "unavailable", reason: words.states[state] }
        : { kind: "available" },
    );
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-destination";
    button.dataset.destination = id;
    button.dataset.state = state;
    button.tabIndex = -1;
    button.setAttribute("aria-label", name);
    const descriptionId = `map-state-${id}`;
    button.setAttribute("aria-describedby", descriptionId);
    if (!presentation.executable) {
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
    const description = document.createElement("span");
    description.hidden = true;
    description.id = descriptionId;
    description.textContent = presentation.reason ?? words.states[state];
    button.append(marker, description);
    const label = document.createElement("p");
    label.className = "map-label ui-text-label";
    label.setAttribute("aria-hidden", "true");
    label.textContent = name;
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
  view.append(content);
  root.append(letterbox, view);
  return { actions, buttons, destinations, letterbox, markers, root, view };
}
