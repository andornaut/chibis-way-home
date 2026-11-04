import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ Input: {}, Scale: {}, Scene: class {}, Scenes: {} }));
vi.mock("./save", () => ({ grantSkill: vi.fn() }));
vi.mock("../data/rooms", () => ({ ROOMS: { gift: { grant: "dash" }, ordinary: {} } }));

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import button from "../../public/art/sprites/ui-button.json";
import primary from "../../public/art/sprites/ui-button-primary.json";
import { TEXT } from "../data/text";
import type { RoomEvent } from "../ui";
import { addButtonLabel, addSlice, BUTTON, paletteColour, PRIMARY_BUTTON } from "./cardParts";
import { RoomScene } from "./RoomScene";
import { grantSkill } from "./save";

const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
vi.mock("./cardParts", async (original) => {
  const actual = await original<typeof import("./cardParts")>();
  return {
    ...actual,
    addButtonLabel: vi.fn(),
    addSlice: vi.fn(),
    cardFonts: () => fonts,
    paletteColour: vi.fn(() => 0),
  };
});

afterEach(() => vi.clearAllMocks());

it("grants the configured room reward on entry without granting anything for an ordinary room", () => {
  const scene = new RoomScene();
  scene.init({ room: "ordinary" });
  expect(grantSkill).not.toHaveBeenCalled();
  scene.init({ room: "gift" });
  expect(grantSkill).toHaveBeenCalledExactlyOnceWith("dash");
});

it.each([
  { room: "gift", style: PRIMARY_BUTTON, text: TEXT.dialogue.continue },
  { room: "ordinary", style: BUTTON, text: TEXT.room.leave },
])(
  "draws the $room footer and preserves one guarded return to the zone",
  ({ room, style, text }) => {
    const controller = { resume: vi.fn(), setVisible: vi.fn(), stop: vi.fn() };
    const scene = Object.assign(new RoomScene(), {
      cache: { json: { get: (key: string) => (key === BUTTON.art ? button : primary) } },
      scene: controller,
    }) as unknown as {
      act(event: RoomEvent): void;
      drawLeave(): void;
      init(data: { room: string }): void;
    };
    scene.init({ room });
    scene.drawLeave();
    expect(addSlice).toHaveBeenCalledTimes(2);
    expect(vi.mocked(addSlice).mock.calls.every(([, key]) => key === style.art)).toBe(true);
    expect(paletteColour).toHaveBeenLastCalledWith(scene, style.label);
    expect(addButtonLabel).toHaveBeenCalledWith(
      scene,
      { colour: 0, marked: false },
      expect.any(Object),
      text,
    );
    scene.act({ down: undefined, kind: "press", up: "leave" });
    expect(controller.resume).not.toHaveBeenCalled();
    scene.act({ down: "leave", kind: "press", up: "leave" });
    scene.act({ down: "leave", kind: "press", up: "leave" });
    expect(controller.setVisible).toHaveBeenCalledExactlyOnceWith(true, "zone");
    expect(controller.resume).toHaveBeenCalledExactlyOnceWith("zone");
    expect(controller.stop).toHaveBeenCalledOnce();
  },
);
