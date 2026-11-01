import { afterEach, describe, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map";

const state = vi.hoisted(() => ({
  accepts: true,
  invalidate: vi.fn(),
  refuse: vi.fn(() => vi.fn()),
}));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./cardParts", () => ({ ringFocus: vi.fn() }));
vi.mock("./modalBackdrop", () => ({ showModalBackdrop: vi.fn() }));
vi.mock("./modalInput", () => ({
  modalInput: () => ({ accepts: () => state.accepts, invalidate: state.invalidate }),
  onScenePointer: vi.fn(),
}));
vi.mock("./playCamera", () => ({
  fitPlayCamera: vi.fn(),
  playPoint: (_scene: unknown, point: { x: number; y: number }) => point,
}));
vi.mock("./refuseControl", () => ({ refuseControl: state.refuse }));

import { StageSelectScene } from "./StageSelectScene";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  state.accepts = true;
});

function fixture() {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  const stages = ZONE_MAP.destinations[0]!.stages;
  const available = stages[0]!;
  const locked = stages[1]!;
  const face = {};
  const preview = {};
  const name = {};
  const number = {};
  const pressed = {};
  const target = {
    content: [preview, name, number].map((object) => ({ object, y: 0 })),
    labels: [name, number],
    normal: face,
    pressed,
  };
  const opener = { stageSelected: vi.fn() };
  const stop = vi.fn();
  const scene = Object.assign(new StageSelectScene(), {
    available: [available],
    buttons: new Map([[locked, target]]),
    layout: {
      buttons: [0, 100].map((x) => ({
        button: { height: 48, width: 48, x, y: 0 },
        hit: { height: 48, width: 48, x, y: 0 },
      })),
      close: {
        art: { height: 24, width: 24, x: 300, y: 0 },
        hit: { height: 48, width: 48, x: 288, y: 0 },
      },
    },
    scene: { get: () => opener, stop },
    stages: [available, locked],
  }) as unknown as {
    activate(target: { id: string; kind: "stage" }): void;
    targetAt(point: { x: number; y: number }): { id: string; kind: "stage" };
  };
  return { available, face, locked, name, number, opener, pressed, preview, scene, stop };
}

describe("disabled stage screenshot cards", () => {
  it("refuses a locked target with every face, screenshot and label, without opening the stage", () => {
    const f = fixture();
    const target = f.scene.targetAt({ x: 120, y: 20 });
    expect(target).toEqual({ id: f.locked, kind: "stage" });
    f.scene.activate(target);
    expect(state.refuse).toHaveBeenCalledOnce();
    const args = state.refuse.mock.calls[0]! as unknown as [
      unknown,
      boolean,
      unknown[],
      unknown[],
      () => void,
    ];
    expect(args[2]).toEqual([f.face, f.pressed, f.preview, f.name, f.number]);
    expect(args[3]).toEqual([f.name, f.number]);
    f.scene.activate(target);
    expect(state.refuse).toHaveBeenCalledOnce();
    expect(f.stop).not.toHaveBeenCalled();
    expect(f.opener.stageSelected).not.toHaveBeenCalled();
    args[4]();
    f.scene.activate({ id: f.available, kind: "stage" });
    expect(f.opener.stageSelected).toHaveBeenCalledExactlyOnceWith(f.available);
  });

  it("keeps controls underneath a covering modal inert without refusal feedback", () => {
    const f = fixture();
    state.accepts = false;
    f.scene.activate({ id: f.locked, kind: "stage" });
    expect(state.refuse).not.toHaveBeenCalled();
    expect(f.opener.stageSelected).not.toHaveBeenCalled();
  });
});

it("rejects hidden stage activation and clears held capture when changing pages", () => {
  const f = fixture();
  const scene = f.scene as unknown as {
    activate(target: { id: string; kind: "stage" }): void;
    changePage(page: number): void;
    page: number;
    pressed: unknown;
    render(): void;
  };
  const render = vi.fn();
  Object.assign(scene, {
    available: [f.available, "hidden"],
    focus: f.available,
    layout: { pages: 2 },
    pressed: { id: f.available, kind: "stage" },
    render,
    stages: [f.available, f.locked, "middle", "hidden"],
  });
  scene.activate({ id: "hidden", kind: "stage" });
  expect(f.opener.stageSelected).not.toHaveBeenCalled();
  scene.changePage(1);
  expect(scene.page).toBe(1);
  expect(scene.pressed).toBeUndefined();
  expect(state.invalidate).toHaveBeenCalledOnce();
  expect(render).toHaveBeenCalledOnce();
  scene.activate({ id: "hidden", kind: "stage" });
  expect(f.opener.stageSelected).toHaveBeenCalledExactlyOnceWith("hidden");
});

it("hides every off-page face and content object while retaining full-size on-page cards", () => {
  const part = () => ({ setVisible: vi.fn().mockReturnThis(), setY: vi.fn().mockReturnThis() });
  const visible = { content: [{ object: part(), y: 100 }], normal: part(), pressed: part() };
  const hidden = { content: [{ object: part(), y: 100 }], normal: part(), pressed: part() };
  const scene = Object.assign(new StageSelectScene(), {
    available: ["one", "four"],
    buttons: new Map([
      ["one", visible],
      ["four", hidden],
    ]),
    closeX: { play: vi.fn() },
    stages: ["one", "two", "three", "four"],
  }) as unknown as { render(): void };
  scene.render();
  expect(visible.normal.setVisible).toHaveBeenCalledWith(true);
  expect(hidden.normal.setVisible).toHaveBeenCalledWith(false);
  expect(hidden.pressed.setVisible).toHaveBeenCalledWith(false);
  expect(hidden.content[0]!.object.setVisible).toHaveBeenCalledWith(false);
});
