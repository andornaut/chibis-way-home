import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class {
    readonly sys = { isActive: () => false };
  },
}));
vi.mock("./save", () => ({ clearProgress: vi.fn() }));
vi.mock("./modalBackdrop", () => ({ showModalBackdrop: vi.fn() }));

import { RestartScene } from "./RestartScene";
import { SettingsScene } from "./SettingsScene";

// Openers can forward input before Phaser processes a queued scene launch.
describe.each([RestartScene, SettingsScene])("inactive forwarded modal %s", (ModalScene) => {
  it("ignores navigation, activation and dismissal before its layout and opener exist", () => {
    const modal = new ModalScene();
    for (const key of ["ArrowDown", "Enter", "Escape"]) {
      const event = { key, repeat: false, shiftKey: false } as KeyboardEvent;
      expect(() => modal.key(event)).not.toThrow();
    }
    expect(() => modal.back()).not.toThrow();
  });
});
