import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TEXT } from "../data/text";
import type { Rect } from "../data/types";
import { CARD_FONTS } from "../testing/cardFonts";

const state = vi.hoisted(() => ({
  pointer: new Map<string, (point: { x: number; y: number }) => void>(),
  texts: [] as { at: Rect; object: { setTint: unknown }; text: string }[],
}));
vi.mock("phaser", () => ({
  Scene: class {
    readonly sys = { isActive: () => true };
  },
}));
vi.mock("./cardParts", () => ({
  BODY_FONT: "body",
  addCardHeading: () => drawn(),
  addCardTextIn: (_scene: unknown, _font: unknown, at: Rect, text: string) => {
    const object = drawn();
    state.texts.push({ at, object, text });
    return object;
  },
  addSlice: () => drawn(),
  cardFonts: () => CARD_FONTS,
  paletteColour: () => 0,
}));
vi.mock("./modalBackdrop", () => ({ showModalBackdrop: vi.fn() }));
vi.mock("./modalInput", () => ({
  modalInput: () => ({ accepts: () => true }),
  onScenePointer: (_scene: unknown, event: string, listener: (point: unknown) => void) =>
    state.pointer.set(event, listener),
}));
vi.mock("./playCamera", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, point: unknown) => point,
}));

import { SettingsScene } from "./SettingsScene";

function drawn() {
  return {
    destroy: vi.fn(),
    play: vi.fn(),
    setOrigin: vi.fn().mockReturnThis(),
    setTint: vi.fn(),
    setVisible: vi.fn(),
  };
}

afterEach(() => {
  state.pointer.clear();
  state.texts.length = 0;
  vi.unstubAllGlobals();
});

// The settings card drawn on the start screen, without the Install row, on a device that does not
// prefer reduced motion.
function fixture() {
  const stored = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    },
    matchMedia: () => ({ matches: false }),
  });
  const opener = { setTouchSetting: vi.fn(), settingsClosed: vi.fn() };
  const sprites: { object: ReturnType<typeof drawn>; x: number; y: number }[] = [];
  const scene = new SettingsScene();
  Object.assign(scene, {
    add: {
      container: () => drawn(),
      image: () => drawn(),
      sprite: (x: number, y: number) => {
        const object = drawn();
        sprites.push({ object, x, y });
        return object;
      },
    },
    opener: "start",
    scene: { get: () => opener, stop: vi.fn() },
    textures: { exists: () => true },
  });
  const internals = scene as unknown as {
    drawCard(installRow: boolean): unknown;
    layout: { reducedMotion: { row: Rect; toggle: { x: number; y: number } } };
    render(): void;
    watchPresses(): void;
  };
  internals.drawCard(false);
  internals.render();
  internals.watchPresses();
  const row = internals.layout.reducedMotion;
  const toggle = sprites.find(({ x, y }) => x === row.toggle.x && y === row.toggle.y)!.object;
  return { opener, row: row.row, scene, stored, toggle };
}

const switchFrame = (on: boolean) => animationKey("ui-switch", on ? "on" : "off");

describe("the settings card's Reduced motion row", () => {
  it("draws its label and switch, off on a device that does not prefer reduced motion", () => {
    const f = fixture();
    const label = state.texts.find(({ text }) => text === TEXT.settings.reducedMotion);
    expect(label?.at.y).toBeGreaterThanOrEqual(f.row.y);
    expect(f.toggle.play).toHaveBeenLastCalledWith(switchFrame(false));
  });

  it("toggles and saves on a tap that lands and lifts on the row", () => {
    const f = fixture();
    const centre = { x: f.row.x + f.row.width / 2, y: f.row.y + f.row.height / 2 };
    state.pointer.get("pointerdown")!(centre);
    state.pointer.get("pointerup")!(centre);
    expect(f.toggle.play).toHaveBeenLastCalledWith(switchFrame(true));
    expect([...f.stored.values()]).toEqual(["on"]);
    expect(f.opener.setTouchSetting).not.toHaveBeenCalled();
  });

  it("toggles and saves when the keyboard focuses the row and presses Enter", () => {
    const f = fixture();
    const press = (key: string) =>
      f.scene.key({ key, repeat: false, shiftKey: false } as KeyboardEvent);
    ["ArrowDown", "ArrowDown", "ArrowDown", "Enter"].forEach(press);
    expect(f.toggle.play).toHaveBeenLastCalledWith(switchFrame(true));
    press("Enter");
    expect(f.toggle.play).toHaveBeenLastCalledWith(switchFrame(false));
    expect([...f.stored.values()]).toEqual(["off"]);
  });
});
