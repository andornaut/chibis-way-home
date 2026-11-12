import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import { type GameObjects, type Input, Scene } from "phaser";

import { ART_MANIFEST_KEY, type ArtManifest } from "../assets/index.ts";
import { MAP_LAYOUT, MAP_PATH } from "../data/layout.ts";
import { MAP_TRAVEL, ZONE_MAP } from "../data/map.ts";
import { TILE } from "../data/screen.ts";
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
  curveWalk,
  destinationAtTap,
  destinationCentre,
  destinationPathLook,
  destinationState,
  MAP_ACTIONS,
  MAP_PATH_LOOKS,
  MAP_SCREEN,
  type MapAction,
  mapKeyAction,
  mapLabel,
  type PathLook,
  pathRects,
  type PressArea,
  pressedArea,
  textInkBounds,
} from "../ui/index.ts";
import {
  addTextButton,
  captureTab,
  pressTextButton,
  PRIMARY_BUTTON,
  ringFocus,
  type TextButton,
} from "./cardParts.ts";
import { modalInput, onScenePointer } from "./modalInput.ts";
import { fitPlayCamera, playPoint } from "./playCamera.ts";
import { savedMap, saveStand } from "./save.ts";
import type { StageSelectData, StageSelectOpener, StageSelectScene } from "./StageSelectScene.ts";
import { uiObject } from "./uiRoots.ts";
import type { ZoneData } from "./ZoneScene.ts";

const PALETTE = "palette";
const TITLE_FONT = "font-title";
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
  private colours: Readonly<Record<string, string>> = {};
  private completed: ReadonlySet<string> = new Set();
  private buttons!: Readonly<Record<MapAction, TextButton>>;
  private focus: MapAction | undefined;
  private focusRing: GameObjects.NineSlice | undefined;
  private open!: OpenMap;
  private pressed: Control | undefined;
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
    this.pressed = undefined;
    this.focus = undefined;
    this.focusRing = undefined;
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
    const { textScale, title } = MAP_SCREEN;
    uiObject(
      this,
      this.add
        .bitmapText(title.x, title.y, TITLE_FONT, TEXT.map.title)
        .setScale(textScale)
        .setTint(this.colour("ink")),
    );
    this.addActions();
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
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      if (!this.selectionOpen && !this.travelling) {
        this.showPressed(this.controlAt(pointer));
      }
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      if (this.selectionOpen || this.travelling) {
        return;
      }
      const control = this.pressed;
      this.showPressed(undefined);
      const lifted = this.controlAt(pointer);
      if (control === undefined || lifted === undefined || !sameControl(control, lifted)) {
        return;
      }
      if (control.kind === "node") {
        this.walkToDestination(control.id);
      } else {
        this.act(control.kind);
      }
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
    this.input.enabled = false;
    this.focus = undefined;
    this.showPressed(undefined);
    this.journey = { bird, bottomOffset, distance: 0, path, previousX: fromAt.x, stage };
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
    const { bird, icon, marker, textScale } = MAP_SCREEN;
    const font = phaserBitmapFont(this.cache.bitmapFont.get(TITLE_FONT).data as PhaserFontData);
    const knockouts = this.add.graphics().fillStyle(this.colour("lgrey"));
    const labels: { at: Point; name: string }[] = [];
    for (const destination of ZONE_MAP.destinations) {
      const name = TEXT.map.zones[destination.id];
      if (name === undefined) {
        throw new Error(`No destination label ${destination.id}`);
      }
      const ink = textInkBounds(font, textScale, font.lineHeight * textScale, name);
      if (inkWidth(font, textScale, name) > MAP_LAYOUT.label.width - 2 * MAP_LAYOUT.label.padding) {
        throw new Error(`Destination label does not fit: ${destination.id}`);
      }
      const { knockout, origin } = mapLabel(ink, this.centre(destination));
      knockouts.fillRect(knockout.x, knockout.y, knockout.width, knockout.height);
      labels.push({ at: origin, name });
    }
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
      this.add
        .sprite(centre.x + marker.zone.x, centre.y + marker.zone.y, "map-zone")
        .setOrigin(0)
        .play(animationKey("map-zone", state));
      if (state !== "unbuilt" && state !== "locked") {
        this.add
          .sprite(centre.x + icon.x, centre.y + icon.y, destination.icon)
          .setOrigin(0)
          .play(animationKey(destination.icon, state === "visited" ? "visited" : "normal"));
      }
    }
    for (const { at, name } of labels) {
      uiObject(
        this,
        this.add
          .bitmapText(at.x, at.y, TITLE_FONT, name)
          .setScale(textScale)
          .setTint(this.colour("ink")),
      );
    }
    const current = destinationForStage(ZONE_MAP, this.stand);
    const centre = this.centre(current);
    this.mapBird = this.add
      .sprite(centre.x + bird.zone.x, centre.y + bird.zone.y, "map-bird")
      .setOrigin(0)
      .play(animationKey("map-bird", "idle"));
  }

  private addActions(): void {
    this.buttons = {
      continue: addTextButton(this, MAP_SCREEN.continue, TEXT.map.continue, {
        style: PRIMARY_BUTTON,
      }),
      home: addTextButton(this, MAP_SCREEN.home, TEXT.pause.home),
    };
  }

  // Both footer actions use the shared normal/pressed faces, label displacement and focus ring.
  private showPressed(control: Control | undefined): void {
    this.pressed = control;
    for (const name of MAP_ACTIONS) {
      pressTextButton(this.buttons[name], control?.kind === name);
    }
    this.focusRing = ringFocus(
      this,
      this.focusRing,
      this.selectionOpen || this.travelling || this.focus === undefined
        ? undefined
        : MAP_SCREEN[this.focus].button,
    );
  }

  private controlAt(pointer: Input.Pointer): Control | undefined {
    const point = playPoint(this, pointer);
    const areas: PressArea<MapAction>[] = MAP_ACTIONS.map((key) => ({
      art: MAP_SCREEN[key].button,
      hit: MAP_SCREEN[key].hit,
      key,
    }));
    const action = pressedArea(areas, point);
    if (action !== undefined) {
      return { kind: action };
    }
    const id = destinationAtTap(TILE, MAP_SCREEN.nodeHit, PLANS, ZONE_MAP, this.open, point);
    return id === undefined ? undefined : { id, kind: "node" };
  }

  private key(event: KeyboardEvent): void {
    if (!modalInput(this).accepts(event)) {
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
      this.showPressed(this.pressed);
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

function sameControl(a: Control, b: Control): boolean {
  return a.kind === b.kind && (a.kind !== "node" || (b.kind === "node" && a.id === b.id));
}
