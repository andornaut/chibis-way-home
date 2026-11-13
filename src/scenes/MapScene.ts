import { animationKey, type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import { writeLayoutProperties } from "@andornaut/game-kit/web/ui/dom/layoutProperties";
import { type GameObjects, Scene } from "phaser";

import { ART_MANIFEST_KEY, type ArtManifest } from "../assets/index.ts";
import { MAP_PATH } from "../data/layout.ts";
import { MAP_TRAVEL, ZONE_MAP } from "../data/map.ts";
import { SCREEN, TILE } from "../data/screen.ts";
import { TEXT } from "../data/text.ts";
import type { MapDestination, Point, Rect } from "../data/types/index.ts";
import { RECIPES } from "../data/zones.ts";
import {
  destinationForStage,
  destinationOf,
  destinationSelection,
  destinationStages,
  type OpenMap,
  openMap,
  stageCompletion,
  steppedDestination,
} from "../progress/index.ts";
import { PHONE_EVENTS } from "../pwa/index.ts";
import {
  bentCurve,
  createMap,
  curveWalk,
  destinationCentre,
  destinationPathLook,
  destinationState,
  MAP_PATH_LOOKS,
  MAP_SCREEN,
  type MapAction,
  mapKeyAction,
  type MapView,
  type PathLook,
  pathRects,
} from "../ui/index.ts";
import { followTaps } from "./domTaps.ts";
import { artFrameUrl, mountSceneView, revealSceneView, sceneDomUi } from "./domUi.ts";
import { captureTab } from "./keyboardCapture.ts";
import { modalInput } from "./modalInput.ts";
import { fitPlayCamera } from "./playCamera.ts";
import { savedMap, saveStand } from "./save.ts";
import type { StageSelectData, StageSelectOpener, StageSelectScene } from "./StageSelectScene.ts";
import type { ZoneData } from "./ZoneScene.ts";

const PALETTE = "palette";
const PLANS = new Set(Object.keys(RECIPES));
// Paths are drawn in this order, so the open ones lie on top.
const LOOK_ORDER: readonly PathLook[] = ["unbuilt", "built", "open"];

// Footer actions, or an open zone node by its id.
type Control = { readonly kind: MapAction } | { readonly kind: "node"; readonly id: string };

interface MapData {
  // A stage-node id, consumed once. Progress stays at the completed stage until arrival.
  readonly travelTo?: string;
}

// The overview renders each themed destination once, with its stage nodes retained in the
// progression graph. Continue on an available destination always opens the closeable stage
// picker, however many of its stages are unlocked. The footer and saved stand keep Continue safe
// as the default action.
export class MapScene extends Scene implements StageSelectOpener {
  private birdFrames = new Map<string, string>();
  private view: MapView | undefined;
  private domReady = false;
  private generation = 0;
  private colours: Readonly<Record<string, string>> = {};
  private completed: ReadonlySet<string> = new Set();
  private focus: MapAction | undefined;
  private open!: OpenMap;
  private stand = ZONE_MAP.start;
  private selectionOpen = false;
  private mapBird!: GameObjects.Sprite;
  private travelRequested: string | undefined;
  private travelling = false;
  private journey:
    | {
        readonly bottomOffset: number;
        distance: number;
        readonly bird: GameObjects.Sprite;
        readonly path: ReturnType<typeof curveWalk>;
        previousX: number;
        readonly stage: string;
      }
    | undefined;

  constructor() {
    super("map");
  }

  // Where he is comes from the saved progress: the map's start with nothing completed from the
  // beginning.
  init(data: MapData = {}): void {
    const { completed, stand } = savedMap();
    this.completed = new Set(completed);
    this.open = openMap(ZONE_MAP, this.completed);
    this.stand = this.open.zones.includes(stand) ? stand : ZONE_MAP.start;
    this.birdFrames = new Map();
    this.view = undefined;
    this.domReady = false;
    this.generation += 1;
    this.focus = undefined;
    this.selectionOpen = false;
    this.travelling = false;
    this.journey = undefined;
    this.travelRequested = undefined;
    this.input.enabled = true;
    if (data.travelTo !== undefined) {
      const completion = stageCompletion(ZONE_MAP, this.completed, this.stand);
      if (completion.kind === "map" && completion.travelTo === data.travelTo) {
        this.travelRequested = data.travelTo;
      }
    }
    // Phaser otherwise retains init data across restarts. Automatic travel is a one-shot request.
    this.sys.settings.data = {};
  }

  create(): void {
    fitPlayCamera(this);
    saveStand(this.stand);
    this.colours = (this.cache.json.get(PALETTE) as { colours: Record<string, string> }).colours;
    this.slice("map-paper", MAP_SCREEN.paper);
    for (const { art, at } of ZONE_MAP.decorations) {
      this.add.sprite(at.x, at.y, art).setOrigin(0).play(animationKey(art, "rest"));
    }
    this.drawPaths();
    this.drawNodes();
    this.addDom();
    this.showPressed(undefined);
    modalInput(this).subscribe(() => this.showPressed(undefined));
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.key(event));
    captureTab(this, true);
    const onBack = (event: Event) => {
      if (this.selectionOpen && !this.travelling) {
        const card = this.scene.get("stageSelect") as StageSelectScene;
        if (modalInput(card).accepts(event)) {
          card.back();
        }
      }
    };
    window.addEventListener(PHONE_EVENTS.backPressed, onBack);
    this.events.once("shutdown", () => {
      captureTab(this, false);
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
      if (this.selectionOpen) {
        this.scene.stop("stageSelect");
      }
      this.selectionOpen = false;
    });
    const travelTo = this.travelRequested;
    this.travelRequested = undefined;
    if (travelTo !== undefined) {
      this.beginAutomaticTravel(travelTo);
    }
  }

  override update(_time: number, deltaMs: number): void {
    const journey = this.journey;
    if (!journey) {
      return;
    }
    journey.distance = Math.min(
      journey.path.length,
      journey.distance + (Math.max(0, deltaMs) * MAP_TRAVEL.speed) / 1000,
    );
    const point = journey.path.at(journey.distance);
    if (point.x !== journey.previousX) {
      journey.bird.setFlipX(point.x < journey.previousX);
    }
    journey.previousX = point.x;
    journey.bird.setPosition(Math.round(point.x), Math.round(point.y + journey.bottomOffset));
    this.maskTravelBird();
    if (journey.distance >= journey.path.length) {
      this.stand = journey.stage;
      saveStand(this.stand);
      this.journey = undefined;
      // Keep input locked through the queued restart. Arrival never starts a stage.
      this.scene.restart({} satisfies MapData);
    }
  }

  private beginAutomaticTravel(stage: string): void {
    const from = destinationForStage(ZONE_MAP, this.stand);
    const to = destinationForStage(ZONE_MAP, stage);
    const fromAt = this.centre(from);
    const toAt = this.centre(to);
    const index = ZONE_MAP.destinations.indexOf(from);
    const path = curveWalk(bentCurve(MAP_PATH.bend, fromAt, toAt, index));
    const bottomOffset = MAP_SCREEN.bird.zone.y + this.mapBird.displayHeight;
    const bird = this.add
      .sprite(fromAt.x, fromAt.y + bottomOffset, "bird")
      .setOrigin(0.5, 1)
      .play(animationKey("bird", "walk"));
    bird.setScale(this.mapBird.displayWidth / bird.width).setFlipX(toAt.x < fromAt.x);
    this.mapBird.setVisible(false);
    this.travelling = true;
    if (this.view !== undefined) {
      this.view.root.inert = true;
    }
    this.input.enabled = false;
    this.focus = undefined;
    this.showPressed(undefined);
    this.journey = { bird, bottomOffset, distance: 0, path, previousX: fromAt.x, stage };
    this.maskTravelBird();
  }

  private centre(destination: MapDestination): Point {
    return destinationCentre(TILE, destination);
  }

  private drawPaths(): void {
    const paths = this.add.graphics();
    const edges = ZONE_MAP.destinations.slice(1).map((to, index) => ({
      from: ZONE_MAP.destinations[index]!,
      index,
      look: destinationPathLook(PLANS, ZONE_MAP, this.open, to),
      to,
    }));
    for (const look of LOOK_ORDER) {
      const { colour, stroke } = MAP_PATH_LOOKS[look];
      paths.fillStyle(this.colour(colour));
      for (const { from, index, to } of edges.filter((edge) => edge.look === look)) {
        const ends = {
          from: this.centre(from),
          fromTrim: MAP_PATH.trim.zone,
          to: this.centre(to),
          toTrim: MAP_PATH.trim.zone,
        };
        const curve = bentCurve(MAP_PATH.bend, ends.from, ends.to, index);
        for (const rect of pathRects(MAP_PATH.step, stroke, ends, curve)) {
          paths.fillRect(rect.x, rect.y, rect.width, rect.height);
        }
      }
    }
  }

  // Every destination and regional miniature stays visible. Only open destinations accept
  // input; locked and unbuilt markers use the authored padlock and question-mark states.
  private drawNodes(): void {
    const { bird, icon } = MAP_SCREEN;
    for (const destination of ZONE_MAP.destinations) {
      const centre = this.centre(destination);
      const state = destinationState(
        PLANS,
        ZONE_MAP,
        this.open,
        this.completed,
        this.stand,
        destination,
      );
      if (state !== "unbuilt" && state !== "locked") {
        this.add
          .sprite(centre.x + icon.x, centre.y + icon.y, destination.icon)
          .setOrigin(0)
          .play(animationKey(destination.icon, state === "visited" ? "visited" : "normal"));
      }
    }
    const current = destinationForStage(ZONE_MAP, this.stand);
    const centre = this.centre(current);
    this.mapBird = this.add
      .sprite(centre.x + bird.zone.x, centre.y + bird.zone.y, "map-bird")
      .setOrigin(0)
      .play(animationKey("map-bird", "idle"));
  }

  private addDom(): void {
    const layer = sceneDomUi(this);
    if (layer === undefined) {
      return;
    }
    const input = modalInput(this);
    input.ready(false);
    const generation = this.generation;
    const faces = ZONE_MAP.destinations.map((destination) => ({
      centre: this.centre(destination),
      id: destination.id,
      name: TEXT.map.zones[destination.id]!,
      state: destinationState(PLANS, ZONE_MAP, this.open, this.completed, this.stand, destination),
    }));
    const view = createMap(
      layer.element.ownerDocument,
      {
        continue: TEXT.map.continue,
        home: TEXT.pause.home,
        states: TEXT.map.destinationStates,
        title: TEXT.map.title,
      },
      faces,
    );
    this.view = view;
    const urls = Promise.all(
      faces.map(async ({ id, state }) => {
        const frame = sheetTags(this.cache.json.get("map-zone") as AsepriteSheet).get(state)?.[0]
          ?.frame;
        if (frame === undefined) {
          throw new Error(`No map-zone frame ${state}`);
        }
        const url = await artFrameUrl(this, "map-zone", frame);
        const marker = view.markers.get(id)!;
        marker.src = url;
        if (state === "locked" || state === "unbuilt") {
          return [url];
        }
        const miniature = destinationOf(ZONE_MAP, id).icon;
        const miniatureTag = state === "visited" ? "visited" : "normal";
        const miniatureFrame = sheetTags(this.cache.json.get(miniature) as AsepriteSheet).get(
          miniatureTag,
        )?.[0]?.frame;
        if (miniatureFrame === undefined) {
          throw new Error(`No miniature frame ${miniature}`);
        }
        const miniatureUrl = await artFrameUrl(this, miniature, miniatureFrame);
        const frameSize = this.textures.getFrame(miniature, miniatureFrame);
        marker.dataset.miniature = "";
        writeLayoutProperties(
          {
            "--map-miniature-height": frameSize.cutHeight,
            "--map-miniature-image": `url("${miniatureUrl}")`,
            "--map-miniature-width": frameSize.cutWidth,
            "--map-miniature-x": MAP_SCREEN.icon.x - MAP_SCREEN.marker.zone.x,
            "--map-miniature-y": MAP_SCREEN.icon.y - MAP_SCREEN.marker.zone.y,
          },
          marker,
        );
        return [url, miniatureUrl];
      }),
    );
    const birdFrames = this.birdFrames;
    const walks = sheetTags(this.cache.json.get("bird") as AsepriteSheet).get("walk");
    if (walks === undefined || walks.length === 0) {
      throw new Error("No map travel walk frames");
    }
    const travelUrls = Promise.all(
      walks.map(async ({ frame }) => {
        const url = await artFrameUrl(this, "bird", frame);
        birdFrames.set(String(frame), url);
        return url;
      }),
    );
    const reveal = revealSceneView(
      this,
      view.root,
      Promise.all([urls, travelUrls]).then(([markers, travel]) => [...markers.flat(), ...travel]),
    );
    mountSceneView(this, view.root);
    const live = () => this.domReady && !this.selectionOpen && !this.travelling;
    const controls = new Map<HTMLButtonElement, Control>([
      [view.buttons.continue, { kind: "continue" }],
      [view.buttons.home, { kind: "home" }],
      ...[...view.destinations].map(
        ([id, button]) => [button, { id, kind: "node" } as Control] as const,
      ),
    ]);
    const controlAt = (target: EventTarget | null) => {
      const button = target instanceof Element ? target.closest("button") : null;
      return button instanceof HTMLButtonElement && controls.has(button) ? button : null;
    };
    const activate = (button: HTMLButtonElement) => {
      if (
        !live() ||
        !modalInput(this).accepts() ||
        button.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }
      const control = controls.get(button)!;
      if (control.kind === "node") {
        this.walkToDestination(control.id);
      } else {
        this.act(control.kind);
      }
    };
    const stop = followTaps(
      { preventDefault: true, target: view.root, view: view.root },
      modalInput(this),
      {
        accepts: live,
        controlAt: (event) => controlAt(event.target),
        land: (button) => {
          if (button.getAttribute("aria-disabled") === "true") {
            return;
          }
          const control = controls.get(button)!;
          this.focus = control.kind === "node" ? undefined : control.kind;
          focusTarget(button);
        },
        show: (button) =>
          controls.forEach((_control, target) =>
            target.toggleAttribute(
              "data-pressed",
              button === target && target.getAttribute("aria-disabled") !== "true",
            ),
          ),
        tap: activate,
      },
    );
    view.root.addEventListener("keydown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.key(event);
    });
    view.root.addEventListener("click", (event) => {
      const button = controlAt(event.target);
      if (event.detail === 0 && button !== null) {
        activate(button);
      }
    });
    const keep = (event: Event) => event.preventDefault();
    view.root.addEventListener("touchstart", keep, { capture: true, passive: false });
    view.root.addEventListener("touchend", keep, { capture: true, passive: false });
    this.events.once("shutdown", () => {
      this.generation += 1;
      reveal.cancel();
      stop();
      view.root.removeEventListener("touchstart", keep, true);
      view.root.removeEventListener("touchend", keep, true);
    });
    void reveal.revealed.then((shown) => {
      if (!shown || generation !== this.generation) {
        return;
      }
      this.maskTravelBird();
      this.domReady = true;
      input.ready(true);
      if (this.travelling) {
        view.root.inert = true;
      }
      if (this.focus !== undefined && !this.travelling && !this.selectionOpen) {
        focusTarget(view.buttons[this.focus]);
      }
    });
  }

  // Mask the whole HTML view so the canvas bird keeps its original position above every UI face.
  private maskTravelBird(): void {
    const root = this.view?.view;
    const bird = this.journey?.bird;
    if (root === undefined || bird === undefined) {
      return;
    }
    const url = this.birdFrames.get(String(bird.frame.name));
    if (url === undefined) {
      return;
    }
    const left = bird.x - bird.originX * bird.displayWidth;
    writeLayoutProperties(
      {
        "--map-bird-height": bird.displayHeight,
        "--map-bird-image": `url("${url}")`,
        "--map-bird-width": bird.displayWidth,
        "--map-bird-x": bird.flipX ? SCREEN.width - left - bird.displayWidth : left,
        "--map-bird-y": bird.y - bird.originY * bird.displayHeight,
      },
      root,
    );
    root.toggleAttribute("data-bird-flipped", bird.flipX);
  }

  private showPressed(control: Control | undefined): void {
    this.view?.buttons.continue.toggleAttribute("data-pressed", control?.kind === "continue");
    this.view?.buttons.home.toggleAttribute("data-pressed", control?.kind === "home");
  }

  private key(event: KeyboardEvent): void {
    if (!this.domReady || !modalInput(this).accepts(event)) {
      return;
    }
    if (this.selectionOpen || this.travelling) {
      return;
    }
    const action = mapKeyAction(this.focus, event);
    if (action?.kind === "step") {
      this.walkToDestination(steppedDestination(PLANS, ZONE_MAP, this.open, this.stand, action.by));
    } else if (action?.kind === "focus") {
      this.focus = action.target;
      if (this.domReady && action.target !== undefined) {
        focusTarget(this.view!.buttons[action.target]);
      }
      this.showPressed(undefined);
    } else if (action?.kind === "activate") {
      this.act(action.target);
    }
  }

  private act(action: MapAction): void {
    if (this.travelling) {
      return;
    }
    if (action === "continue") {
      this.selectDestination(destinationForStage(ZONE_MAP, this.stand).id);
    } else {
      // Returning to the title changes no completed zones or saved map position.
      this.scene.start("start");
    }
  }

  private walkToDestination(id: string): void {
    if (this.travelling) {
      return;
    }
    const stages = destinationStages(PLANS, ZONE_MAP, this.open, destinationOf(ZONE_MAP, id));
    const stage = stages.at(-1);
    if (stage !== undefined && !destinationOf(ZONE_MAP, id).stages.includes(this.stand)) {
      saveStand(stage);
      this.scene.restart();
    }
  }

  private selectDestination(id: string): void {
    if (this.travelling) {
      return;
    }
    const selection = destinationSelection(PLANS, ZONE_MAP, this.open, destinationOf(ZONE_MAP, id));
    if (selection.kind === "unavailable") {
      return;
    }
    this.stand = selection.latest;
    saveStand(this.stand);
    this.selectionOpen = true;
    this.showPressed(undefined);
    this.scene.launch("stageSelect", { destination: id } satisfies StageSelectData);
  }

  stageSelectionClosed(): void {
    if (this.selectionOpen) {
      this.selectionOpen = false;
      this.scene.restart();
    }
  }

  stageSelected(stage: string): void {
    if (!this.selectionOpen || this.travelling) {
      return;
    }
    const destination = destinationForStage(ZONE_MAP, this.stand);
    if (!destinationStages(PLANS, ZONE_MAP, this.open, destination).includes(stage)) {
      return;
    }
    this.selectionOpen = false;
    this.play(stage);
  }

  private play(stage: string): void {
    saveStand(stage);
    this.scene.start("zone", { node: stage } satisfies ZoneData);
  }

  private slice(key: string, rect: Rect): GameObjects.NineSlice {
    const entry = (this.cache.json.get(ART_MANIFEST_KEY) as ArtManifest).sprites.find(
      (sprite) => sprite.key === key,
    );
    const slice = entry?.slice;
    if (!slice) {
      throw new Error(`No 9-slice edges for ${key}`);
    }
    const { bottom, left, right, top } = slice;
    return this.add
      .nineslice(rect.x, rect.y, key, undefined, rect.width, rect.height, left, right, top, bottom)
      .setOrigin(0);
  }

  private colour(name: string): number {
    const hex = this.colours[name];
    if (hex === undefined) {
      throw new Error(`The palette has no ${name}`);
    }
    return Number.parseInt(hex.slice(1), 16);
  }
}
