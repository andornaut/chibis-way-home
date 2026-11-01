import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { inkWidth } from "@andornaut/game-kit/text/bitmapFont";
import {
  phaserBitmapFont,
  type PhaserFontData,
} from "@andornaut/game-kit/text/phaser/phaserBitmapFont";
import { type GameObjects, type Input, Scene } from "phaser";

import { ZONE_MAP } from "../data/map";
import { STAGE_PREVIEWS } from "../data/stagePreviews";
import { TEXT } from "../data/text";
import { RECIPES, ZONES } from "../data/zones";
import { stageSelectKey } from "../input/stageSelectInput";
import { type PressArea, pressedArea } from "../layout/hitAreas";
import { STAGE_NUMBER_SCALE, stageSelectCard } from "../layout/stageSelectCard";
import { openMap } from "../rules/map";
import { destinationOf, destinationSelection } from "../rules/mapDestinations";
import { savedMap } from "../save";
import {
  addCardText,
  addCardTextIn,
  addSlice,
  BODY_FONT,
  captureTab,
  cardFonts,
  paletteColour,
  ringFocus,
  TITLE_FONT,
} from "./cardParts";
import { showModalBackdrop } from "./modalBackdrop";
import { modalInput, onScenePointer } from "./modalInput";
import { catchModalTaps } from "./modalTaps";
import { fitPlayCamera, playPoint } from "./playCamera";
import { refuseControl } from "./refuseControl";

export interface StageSelectData {
  readonly destination: string;
}
export interface StageSelectOpener {
  stageSelected(stage: string): void;
  stageSelectionClosed(): void;
}

type Target = { readonly kind: "stage"; readonly id: string } | { readonly kind: "close" };
const PLANS = new Set([...Object.keys(ZONES), ...Object.keys(RECIPES)]);
type StageCardLayout = ReturnType<typeof stageSelectCard>["buttons"][number];
interface StageCardView {
  readonly content: readonly {
    readonly object: GameObjects.Image | GameObjects.BitmapText;
    readonly y: number;
  }[];
  readonly labels: readonly GameObjects.BitmapText[];
  readonly layout: StageCardLayout;
  readonly normal: GameObjects.NineSlice;
  readonly pressed: GameObjects.NineSlice;
}

// Catalogue positions are fixed. Locked cards stay visible but cannot receive focus or activate.
export class StageSelectScene extends Scene {
  private layout!: ReturnType<typeof stageSelectCard>;
  private stages: readonly string[] = [];
  private available: readonly string[] = [];
  private latest = "";
  private destination = "";
  private focus: string | undefined;
  private ring: GameObjects.NineSlice | undefined;
  private pressed: Target | undefined;
  private closeX!: GameObjects.Sprite;
  private buttons = new Map<string, StageCardView>();
  private finished = false;
  private refusals = new Map<string, () => void>();
  constructor() {
    super("stageSelect");
  }
  init({ destination }: StageSelectData): void {
    const progress = savedMap();
    const catalogue = destinationOf(ZONE_MAP, destination);
    const selection = destinationSelection(
      PLANS,
      ZONE_MAP,
      openMap(ZONE_MAP, new Set(progress.completed)),
      catalogue,
    );
    if (selection.kind !== "choose") {
      throw new Error(`Stage picker requires an unlocked stage: ${destination}`);
    }
    this.stages = catalogue.stages;
    this.available = selection.stages;
    this.latest = selection.latest;
    this.destination = destination;
    this.focus = undefined;
    this.ring = undefined;
    this.pressed = undefined;
    this.buttons = new Map();
    this.finished = false;
    this.refusals = new Map();
  }
  create(): void {
    fitPlayCamera(this);
    const title = TEXT.map.zones[this.destination];
    if (title === undefined) {
      throw new Error(`No destination label ${this.destination}`);
    }
    this.layout = stageSelectCard(
      cardFonts(this),
      title,
      this.stages.map((id) => TEXT.map.stages[id]!),
    );
    addSlice(this, "ui-settings-card", this.layout.card);
    addCardTextIn(this, TITLE_FONT, this.layout.title, title, paletteColour(this, "ink"));
    const font = phaserBitmapFont(this.cache.bitmapFont.get(BODY_FONT).data as PhaserFontData);
    this.stages.forEach((id, index) => {
      const layout = this.layout.buttons[index]!;
      const available = this.available.includes(id);
      const primary = id === this.latest;
      const art = primary ? "ui-button-primary" : "ui-button";
      const normal = addSlice(this, art, layout.button, "normal");
      const pressed = addSlice(this, art, layout.button, "pressed").setVisible(false);
      const previewKey = STAGE_PREVIEWS[id];
      if (previewKey === undefined || !this.textures.exists(previewKey)) {
        throw new Error(`No stage screenshot ${id}`);
      }
      const image = this.add
        .image(layout.preview.x, layout.preview.y, previewKey)
        .setOrigin(0)
        .setDisplaySize(layout.preview.width, layout.preview.height);
      const name = addCardTextIn(
        this,
        BODY_FONT,
        layout.name,
        layout.text,
        paletteColour(this, available ? (primary ? "white" : "ink") : "grey"),
      );
      const numberText = TEXT.map.stageNumber.replace("{number}", String(index + 1));
      const numberWidth = inkWidth(font, STAGE_NUMBER_SCALE, numberText);
      if (numberWidth > layout.number.width) {
        throw new Error(`Stage number does not fit: ${id}`);
      }
      const number = addCardText(
        this,
        BODY_FONT,
        { x: layout.number.x + layout.number.width - numberWidth, y: layout.number.y },
        numberText,
        paletteColour(this, primary ? "white" : "grey"),
      )
        .setScale(STAGE_NUMBER_SCALE)
        .setAlpha(0.7);
      if (!available) {
        normal.setTint(paletteColour(this, "lgrey"));
        image.setTint(paletteColour(this, "grey")).setAlpha(0.45);
        name.setAlpha(0.7);
        number.setAlpha(0.5);
      }
      this.buttons.set(id, {
        content: [image, name, number].map((object) => ({ object, y: object.y })),
        labels: [name, number],
        layout,
        normal,
        pressed,
      });
    });
    this.closeX = this.add
      .sprite(this.layout.close.at.x, this.layout.close.at.y, "ui-close")
      .setOrigin(0);
    this.render();
    catchModalTaps(this, this.cameras.main, {
      close: () => this.back(),
      covered: () => [
        this.layout.card,
        this.layout.close.hit,
        ...this.layout.buttons.map(({ hit }) => hit),
      ],
    });
    this.watchInput();
    modalInput(this).subscribe(() => {
      for (const stop of this.refusals.values()) {
        stop();
      }
      this.pressed = undefined;
      this.render();
    });
    captureTab(this, true);
    this.events.once("shutdown", () => captureTab(this, false));
    showModalBackdrop(this);
  }
  back(): void {
    if (!modalInput(this).accepts()) {
      return;
    }
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.scene.stop();
    (this.scene.get("map") as unknown as StageSelectOpener).stageSelectionClosed();
  }
  private render(): void {
    for (const [id, button] of this.buttons) {
      const pressed =
        this.available.includes(id) && this.pressed?.kind === "stage" && this.pressed.id === id;
      button.normal.setVisible(!pressed);
      button.pressed.setVisible(pressed);
      for (const { object, y } of button.content) {
        object.setY(y + (pressed ? 1 : 0));
      }
    }
    this.closeX.play(
      animationKey("ui-close", this.pressed?.kind === "close" ? "pressed" : "normal"),
    );
    const at =
      this.focus === "close"
        ? this.layout.close.art
        : this.focus === undefined
          ? undefined
          : this.buttons.get(this.focus)?.layout.button;
    this.ring = ringFocus(this, this.ring, at);
  }
  private targetAt(pointer: Input.Pointer): Target | undefined {
    const areas: PressArea<string>[] = [
      ...this.stages.map((key, index) => ({
        art: this.layout.buttons[index]!.button,
        hit: this.layout.buttons[index]!.hit,
        key,
      })),
      { art: this.layout.close.art, hit: this.layout.close.hit, key: "close" },
    ];
    const key = pressedArea(areas, playPoint(this, pointer));
    return key === undefined
      ? undefined
      : key === "close"
        ? { kind: "close" }
        : { id: key, kind: "stage" };
  }
  private activate(target: Target): void {
    if (target.kind === "close") {
      this.back();
      return;
    }
    if (this.finished || !modalInput(this).accepts()) {
      return;
    }
    if (!this.available.includes(target.id)) {
      const button = this.buttons.get(target.id);
      if (button && !this.refusals.has(target.id)) {
        const stop = refuseControl(
          this,
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          [button.normal, button.pressed, ...button.content.map(({ object }) => object)],
          button.labels,
          () => this.refusals.delete(target.id),
        );
        this.refusals.set(target.id, stop);
      }
      return;
    }
    this.finished = true;
    this.scene.stop();
    (this.scene.get("map") as unknown as StageSelectOpener).stageSelected(target.id);
  }
  private watchInput(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
      event.stopPropagation();
      const next = stageSelectKey(this.latest, this.available, this.focus, event);
      this.focus = next.focus;
      this.render();
      if (next.close) {
        this.back();
      } else if (next.stage !== undefined) {
        this.activate({ id: next.stage, kind: "stage" });
      }
    });
    this.input.keyboard?.on("keyup", (event: KeyboardEvent) => event.stopPropagation());
    onScenePointer(this, "pointerdown", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      this.pressed = this.targetAt(pointer);
      this.render();
    });
    onScenePointer(this, "pointerup", (pointer: Input.Pointer) => {
      this.input.stopPropagation();
      const down = this.pressed;
      this.pressed = undefined;
      this.render();
      const up = this.targetAt(pointer);
      if (
        !pointer.wasCanceled &&
        down &&
        up &&
        down.kind === up.kind &&
        (down.kind === "close" || (up.kind === "stage" && down.id === up.id))
      ) {
        this.activate(down);
      }
    });
  }
}
