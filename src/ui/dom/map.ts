import { controlPresentation } from "@andornaut/game-kit/runtime/ui/controlPresentation";
import { writeLayoutProperties } from "@andornaut/game-kit/runtime/web/ui/dom/layoutProperties";

import { MAP_LAYOUT } from "../../data/layout.ts";
import type { Point, Rect } from "../../data/types/index.ts";
import type { MapAction } from "../input/mapInput.ts";
import { MAP_SCREEN } from "../layout/mapScreen.ts";
import { mountUiLayout, type UiLayoutNode } from "./layoutTree.ts";

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
  readonly letterbox: HTMLElement;
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

export const MAP_TITLE_PROPERTIES = {
  "--map-title-width": MAP_SCREEN.title.width,
  "--map-x": MAP_SCREEN.title.x,
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
  content.className = "map-content ui-action-row";
  writeLayoutProperties({ "--ui-action-y": MAP_SCREEN.actionY }, content);
  const children: UiLayoutNode[] = [
    {
      component: "Text",
      key: "title",
      kind: "component",
      props: {
        className: "map-title",
        id: "map-title",
        ref: (title) =>
          writeLayoutProperties(
            {
              "--map-title-width": MAP_SCREEN.title.width,
              "--map-x": MAP_SCREEN.title.x,
              "--map-y": MAP_SCREEN.title.y,
            },
            title,
          ),
        tag: "h1",
        text: words.title,
      },
    },
  ];
  const controls = new Map<MapAction, HTMLButtonElement>();
  for (const key of ["continue", "home"] as const) {
    children.push({
      component: "Button",
      key,
      kind: "component",
      props: {
        control: key,
        label: words[key],
        primary: key === "continue",
        ref: (button) => {
          button.classList.add("ui-anchored-action");
          controls.set(key, button);
        },
      },
    });
  }
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
    button.className = "map-destination ui-press";
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
    children.push(
      {
        component: "Native",
        key: `destination-${id}`,
        kind: "component",
        props: { element: button },
        slots: {
          content: [
            { component: "Native", key: "marker", kind: "component", props: { element: marker } },
            {
              component: "Text",
              key: "state",
              kind: "component",
              props: {
                attributes: { hidden: "" },
                id: descriptionId,
                tag: "span",
                text: presentation.reason ?? words.states[state],
              },
            },
          ],
        },
      },
      {
        component: "Text",
        key: `label-${id}`,
        kind: "component",
        props: {
          attributes: { "aria-hidden": "true" },
          className: "map-label",
          ref: (label) =>
            box(
              {
                height: MAP_LAYOUT.label.height,
                width: MAP_LAYOUT.label.width,
                x: centre.x - MAP_LAYOUT.label.width / 2,
                y: centre.y + MAP_LAYOUT.label.top,
              },
              label,
            ),
          tag: "p",
          text: name,
        },
      },
    );
    destinations.set(id, button);
    markers.set(id, marker);
  }
  mountUiLayout(document, document.createElement("div"), {
    component: "Native",
    key: "map",
    kind: "component",
    props: { element: root },
    slots: {
      content: [
        { component: "Native", key: "letterbox", kind: "component", props: { element: letterbox } },
        {
          component: "Native",
          key: "view",
          kind: "component",
          props: { element: view },
          slots: {
            content: [
              {
                component: "Native",
                key: "content",
                kind: "component",
                props: { element: content },
                slots: { content: children },
              },
            ],
          },
        },
      ],
    },
  });
  const buttons = { continue: controls.get("continue")!, home: controls.get("home")! };
  return { buttons, destinations, letterbox, markers, root, view };
}
