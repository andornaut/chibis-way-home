import { expect, it, vi } from "vitest";

import { DIALOGUE_PANEL_ALPHA } from "../data/dialogues";
import { DIALOGUE_SCREEN } from "../ui";
import { DIALOGUE_PANEL_KEY, drawDialoguePanel } from "./dialoguePanel";

const SOURCES = import.meta.glob<string>(["../**/*.ts", "!../**/*.test.ts"], {
  eager: true,
  import: "default",
  query: "?raw",
});

// Every scene that shows a dialogue, bark, gift-room helper or achievement notice panel; each
// draws its background and its portrait and text through the shared renderers.
const PANEL_SCENES = [
  "../scenes/AchievementNoticeScene.ts",
  "../scenes/DialogueScene.ts",
  "../scenes/RoomScene.ts",
  "../scenes/ZoneBarkScene.ts",
];

it("draws the dialogue box at the shared translucent alpha", () => {
  const image = { setAlpha: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis() };
  const add = { image: vi.fn(() => image) };
  expect(drawDialoguePanel({ add } as never)).toBe(image);
  expect(add.image).toHaveBeenCalledExactlyOnceWith(
    DIALOGUE_SCREEN.box.x,
    DIALOGUE_SCREEN.box.y,
    DIALOGUE_PANEL_KEY,
  );
  expect(image.setOrigin).toHaveBeenCalledWith(0);
  expect(image.setAlpha).toHaveBeenCalledExactlyOnceWith(DIALOGUE_PANEL_ALPHA);
  expect(DIALOGUE_PANEL_ALPHA).toBeLessThan(1);
});

it("draws every dialogue panel background only through the shared renderer", () => {
  const owner = "../scenes/dialoguePanel.ts";
  const others = Object.entries(SOURCES).filter(([path]) => path !== owner);
  expect(others.length).toBeGreaterThan(PANEL_SCENES.length);
  for (const [path, source] of others) {
    expect(source, path).not.toContain(DIALOGUE_PANEL_KEY);
    if (path !== "../data/dialogues.ts") {
      expect(source, path).not.toContain("DIALOGUE_PANEL_ALPHA");
    }
    if (source.includes("drawDialogueParagraph(")) {
      expect(source, path).toContain("drawDialoguePanel(this)");
    }
  }
  for (const path of PANEL_SCENES) {
    expect(SOURCES[path], path).toContain("drawDialoguePanel(this)");
    expect(SOURCES[path], path).toContain("drawDialogueParagraph(this");
  }
});
