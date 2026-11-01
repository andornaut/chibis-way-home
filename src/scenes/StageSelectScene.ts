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
import { stagePickerKey } from "../input/stageSelectInput";
import { cardTextOrigin } from "../layout/contentCard";
import { type PressArea, pressedArea } from "../layout/hitAreas";
import {
  STAGE_NUMBER_SCALE,
  stagePageOf,
  STAGES_PER_PAGE,
  stageSelectPages,
} from "../layout/stageSelectCard";
import { openMap } from "../rules/map";
import { destinationOf, destinationSelection } from "../rules/mapDestinations";
import { savedMap } from "../save";
import {
  addCardText,
  addCardTextIn,
  addSlice,
  addTextButton,
  BODY_FONT,
  captureTab,
  cardFonts,
  paletteColour,
  pressTextButton,
  ringFocus,
  type TextButton,
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

type Target =
  | { readonly kind: "stage"; readonly id: string }
  | { readonly kind: "close" }
  | { readonly kind: "page"; readonly step: -1 | 1 };
const PLANS = new Set([...Object.keys(ZONES), ...Object.keys(RECIPES)]);
type StageCardLayout = ReturnType<typeof stageSelectPages>["buttons"][number];
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
  private layout!: ReturnType<typeof stageSelectPages>;
  private stages: readonly string[] = [];
  private available: readonly string[] = [];
  private latest = "";
  private page = 0;
  private pager = new Map<"previousPage" | "nextPage", TextButton>();
  private pageCount: GameObjects.BitmapText | undefined;
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
    this.page = stagePageOf(this.stages, this.latest);
    this.pager = new Map();
    this.pageCount = undefined;
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
    this.layout = stageSelectPages(
      cardFonts(this),
      TEXT.map.stagePages,
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
    if (this.layout.pager) {
      for (const [key, layout, text] of [
        ["previousPage", this.layout.pager.previous, TEXT.map.stagePages.previous],
        ["nextPage", this.layout.pager.next, TEXT.map.stagePages.next],
      ] as const) {
        this.pager.set(key, addTextButton(this, layout, text));
      }
      this.pageCount = addCardTextIn(
        this,
        BODY_FONT,
        this.layout.pager.count,
        this.pageText(),
        paletteColour(this, "ink"),
      );
    }
    this.closeX = this.add
      .sprite(this.layout.close.at.x, this.layout.close.at.y, "ui-close")
      .setOrigin(0);
    this.render();
    catchModalTaps(this, this.cameras.main, {
      close: () => this.back(),
      covered: () => [
        this.layout.card,
        this.layout.close.hit,
        ...this.visibleStages().map((id) => this.buttons.get(id)!.layout.hit),
        ...[...this.pager.values()].map(({ layout }) => layout.hit),
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
      const visible = this.visibleStages().includes(id);
      const pressed =
        this.available.includes(id) && this.pressed?.kind === "stage" && this.pressed.id === id;
      button.normal.setVisible(visible && !pressed);
      button.pressed.setVisible(visible && pressed);
      for (const { object, y } of button.content) {
        object.setVisible(visible).setY(y + (pressed ? 1 : 0));
      }
    }
    for (const [key, button] of this.pager) {
      const enabled = this.pageKeys().includes(key);
      const pressed =
        enabled &&
        this.pressed?.kind === "page" &&
        this.pressed.step === (key === "previousPage" ? -1 : 1);
      pressTextButton(button, pressed);
      button.faces.normal.setTint(paletteColour(this, enabled ? "white" : "lgrey"));
      button.label.label.setTint(paletteColour(this, enabled ? "ink" : "grey"));
    }
    if (this.pageCount && this.layout.pager) {
      const text = this.pageText();
      const origin = cardTextOrigin(cardFonts(this).body, this.layout.pager.count, text);
      this.pageCount.setText(text).setPosition(origin.x, origin.y);
    }
    this.closeX.play(
      animationKey("ui-close", this.pressed?.kind === "close" ? "pressed" : "normal"),
    );
    const at =
      this.focus === "close"
        ? this.layout.close.art
        : this.focus === undefined
          ? undefined
          : (this.pager.get(this.focus as "previousPage" | "nextPage")?.layout.button ??
            this.buttons.get(this.focus)?.layout.button);
    this.ring = ringFocus(this, this.ring, at);
  }
  private targetAt(pointer: Input.Pointer): Target | undefined {
    const areas: PressArea<string>[] = [
      ...this.visibleStages().map((key) => ({
        art: this.layout.buttons[this.stages.indexOf(key)]!.button,
        hit: this.layout.buttons[this.stages.indexOf(key)]!.hit,
        key,
      })),
      ...[...this.pager].map(([key, button]) => ({
        art: button.layout.button,
        hit: button.layout.hit,
        key,
      })),
      { art: this.layout.close.art, hit: this.layout.close.hit, key: "close" },
    ];
    const key = pressedArea(areas, playPoint(this, pointer));
    return key === undefined
      ? undefined
      : key === "close"
        ? { kind: "close" }
        : key === "previousPage" || key === "nextPage"
          ? { kind: "page", step: key === "previousPage" ? -1 : 1 }
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
    if (target.kind === "page") {
      this.changePage(this.page + target.step);
      return;
    }
    if (!this.visibleStages().includes(target.id)) {
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
  private visibleStages(): readonly string[] {
    return this.stages.slice(this.page * STAGES_PER_PAGE, (this.page + 1) * STAGES_PER_PAGE);
  }
  private pageKeys(): ("previousPage" | "nextPage")[] {
    return [
      ...(this.page > 0 ? ["previousPage" as const] : []),
      ...(this.page + 1 < this.layout.pages ? ["nextPage" as const] : []),
    ];
  }
  private pageText(): string {
    return TEXT.map.stagePages.page
      .replace("{page}", String(this.page + 1))
      .replace("{pages}", String(this.layout.pages));
  }
  private changePage(page: number): void {
    if (page === this.page || !modalInput(this).accepts()) {
      return;
    }
    if (page < 0 || page >= this.layout.pages) {
      const button = this.pager.get(page < 0 ? "previousPage" : "nextPage");
      const key = page < 0 ? "previousPage" : "nextPage";
      if (button && !this.refusals.has(key)) {
        this.refusals.set(
          key,
          refuseControl(
            this,
            window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            [button.faces.normal, button.faces.pressed, button.label.label],
            [button.label.label],
            () => this.refusals.delete(key),
          ),
        );
      }
      return;
    }
    for (const stop of this.refusals.values()) {
      stop();
    }
    this.refusals.clear();
    this.pressed = undefined;
    this.page = page;
    if (this.focus !== undefined && !this.visibleStages().includes(this.focus)) {
      this.focus = this.visibleStages().find((id) => this.available.includes(id));
    }
    modalInput(this).invalidate();
    this.render();
  }
  private watchInput(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!modalInput(this).accepts(event)) {
        return;
      }
      event.stopPropagation();
      const next = stagePickerKey(
        { focus: this.focus, latest: this.latest, pages: this.pageKeys(), stages: this.available },
        event,
      );
      this.focus = next.focus;
      if (next.focus !== undefined && this.stages.includes(next.focus)) {
        this.changePage(stagePageOf(this.stages, next.focus));
      }
      if (next.page !== undefined) {
        this.changePage(this.page + next.page);
      }
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
        (down.kind === "close" ||
          (down.kind === "stage" && up.kind === "stage" && down.id === up.id) ||
          (down.kind === "page" && up.kind === "page" && down.step === up.step))
      ) {
        this.activate(down);
      }
    });
  }
}
