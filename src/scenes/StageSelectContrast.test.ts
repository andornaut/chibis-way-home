import { expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";
import { TEXT } from "../data/text";
import { CARD_FONTS } from "../testing/cardFonts";

vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("@andornaut/game-kit/text/phaser/phaserBitmapFont", () => ({
  phaserBitmapFont: () => CARD_FONTS.body,
}));
vi.mock("./cardParts", async (original) => ({
  ...(await original<typeof import("./cardParts")>()),
  addCardText: (_scene: unknown, _font: string, _at: unknown, text: string, colour: string) =>
    label(text, colour),
  addCardTextIn: (_scene: unknown, _font: string, _at: unknown, text: string, colour: string) =>
    label(text, colour),
  addSlice: () => drawable(),
  addTextButton: () => ({}),
  captureTab: vi.fn(),
  cardFonts: () => CARD_FONTS,
  paletteColour: (_scene: unknown, colour: string) => colour,
}));
vi.mock("./modalBackdrop", () => ({ showModalBackdrop: vi.fn() }));
vi.mock("./modalInput", () => ({
  modalInput: () => ({ subscribe: vi.fn() }),
  onScenePointer: vi.fn(),
}));
vi.mock("./modalTaps", () => ({ catchModalTaps: vi.fn() }));
vi.mock("./playCamera", () => ({ fitPlayCamera: vi.fn() }));

import { StageSelectScene } from "./StageSelectScene";

const labels: { alpha: number; colour: string; text: string }[] = [];
function drawable() {
  return {
    play: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
  };
}
function label(text: string, colour: string) {
  const state = { alpha: 1, colour, text };
  labels.push(state);
  const item = drawable();
  item.setAlpha.mockImplementation((alpha: number) => {
    state.alpha = alpha;
    return item;
  });
  return item;
}
it("keeps all unlocked names and ordinals legible on both Apartment pages, dimming only locked cards", () => {
  const destination = ZONE_MAP.destinations.find(({ stages }) => stages.length === 6)!;
  const stages = destination.stages;
  const scene = {
    add: { image: () => drawable(), sprite: () => drawable() },
    available: stages.slice(0, 4),
    buttons: new Map(),
    cache: { bitmapFont: { get: () => ({ data: {} }) } },
    cameras: { main: {} },
    destination: destination.id,
    events: { once: vi.fn() },
    latest: stages[3],
    page: 0,
    pager: new Map(),
    refusals: new Map(),
    render: vi.fn(),
    stages,
    textures: { exists: () => true },
    watchInput: vi.fn(),
  };
  Object.setPrototypeOf(scene, StageSelectScene.prototype);
  StageSelectScene.prototype.create.call(scene as unknown as StageSelectScene);
  const numbers = stages.map((_, index) =>
    labels.find(
      ({ text }) => text === TEXT.map.stageNumber.replace("{number}", String(index + 1)),
    )!,
  );
  const names = stages.map((id) => labels.find(({ text }) => text === TEXT.map.stages[id])!);
  expect(numbers.map(({ colour }) => colour)).toEqual([
    "ink",
    "ink",
    "ink",
    "white",
    "grey",
    "grey",
  ]);
  expect(names.map(({ colour }) => colour)).toEqual(numbers.map(({ colour }) => colour));
  expect(numbers.map(({ alpha }) => alpha)).toEqual([1, 1, 1, 1, 0.5, 0.5]);
  expect(names.map(({ alpha }) => alpha)).toEqual([1, 1, 1, 1, 0.7, 0.7]);
});
