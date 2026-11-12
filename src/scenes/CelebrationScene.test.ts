import { beforeEach, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../pwa/index.ts", () => ({ PHONE_EVENTS: {} }));
vi.mock("./modalInput.ts", () => ({ modalInput: () => ({ accepts: () => true }) }));

import { CelebrationScene } from "./CelebrationScene.ts";

type Keyed = { focus: string | undefined; key(event: Partial<KeyboardEvent>): void };

beforeEach(() => {
  vi.clearAllMocks();
});

it("moves the keyboard's focus through Continue then Restart, wrapping, and presses the focused one", () => {
  const launch = vi.fn(),
    start = vi.fn();
  const scene = Object.assign(new CelebrationScene(), {
    render: vi.fn(),
    scene: { key: "celebration", launch, start },
  }) as unknown as Keyed;
  const key = (value: string) => scene.key({ key: value, repeat: false, shiftKey: false });
  const steps = ["Tab", "Tab", "Tab", "Tab"].map((value) => {
    key(value);
    return scene.focus;
  });
  expect(steps).toEqual(["continue", "restart", "continue", "restart"]);
  key("Enter");
  expect(launch).toHaveBeenCalledExactlyOnceWith("restart", { opener: "celebration" });
  expect(start).not.toHaveBeenCalled();
});
