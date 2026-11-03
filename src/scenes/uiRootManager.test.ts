import type { UiRootHandle } from "@andornaut/game-kit/view/phaser/uiCommands";
import type { GameObjects, Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { createUiRootManager } from "./uiRootManager";

const object = () => ({ type: "Image" }) as unknown as GameObjects.GameObject;
function handle(roots: readonly GameObjects.GameObject[]): UiRootHandle {
  return {
    destroy: vi.fn(),
    owner: {},
    refresh: vi.fn(() => ({ status: "ready" as const })),
    roots,
  };
}
it("restores every previous UI group when a new modal cannot be registered", () => {
  const start = {} as Scene,
    settings = {} as Scene;
  const root = object(),
    modal = object(),
    old = handle([root]);
  const register = vi
    .fn()
    .mockReturnValueOnce({ handle: old, status: "ready" })
    .mockReturnValueOnce({ issues: [{ owner: {}, reason: "effect" }], status: "unsupported" });
  const manager = createUiRootManager({ register });
  expect(manager.sync([{ roots: [root], scene: start }])).toBe(true);
  expect(
    manager.sync([
      { roots: [root], scene: start },
      { roots: [modal], scene: settings },
    ]),
  ).toBe(false);
  expect(old.destroy).toHaveBeenCalledOnce();
  expect(manager.owner(start)).toBeUndefined();
  expect(manager.owner(settings)).toBeUndefined();
});
it("refreshes changed Container membership atomically without recreating stable registrations", () => {
  const scene = {} as Scene,
    first = object(),
    focus = object();
  const container = { list: [first], type: "Container" } as unknown as GameObjects.Container;
  const owned = handle([container]),
    register = vi.fn(() => ({ handle: owned, status: "ready" as const }));
  const manager = createUiRootManager({ register });
  const plan = [{ roots: [container], scene }];
  expect(manager.sync(plan)).toBe(true);
  expect(manager.sync(plan)).toBe(true);
  expect(owned.refresh).not.toHaveBeenCalled();
  container.list.push(focus);
  expect(manager.sync(plan)).toBe(true);
  expect(owned.refresh).toHaveBeenCalledExactlyOnceWith([container]);
  expect(register).toHaveBeenCalledOnce();
  expect(container.list).toEqual([first, focus]);
  manager.sync([]);
  expect(owned.destroy).toHaveBeenCalledOnce();
});
it("restores the coherent domain when replacement membership becomes unsupported", () => {
  const firstScene = {} as Scene,
    secondScene = {} as Scene;
  const root = object(),
    modal = object(),
    first = handle([root]),
    second = handle([modal]);
  vi.mocked(second.refresh).mockReturnValue({
    issues: [{ owner: second.owner, reason: "mask" }],
    status: "unsupported",
  });
  const register = vi
    .fn()
    .mockReturnValueOnce({ handle: first, status: "ready" })
    .mockReturnValueOnce({ handle: second, status: "ready" });
  const manager = createUiRootManager({ register });
  expect(
    manager.sync([
      { roots: [root], scene: firstScene },
      { roots: [modal], scene: secondScene },
    ]),
  ).toBe(true);
  expect(
    manager.sync([
      { roots: [root], scene: firstScene },
      { roots: [modal, object()], scene: secondScene },
    ]),
  ).toBe(false);
  expect(first.destroy).toHaveBeenCalledOnce();
  expect(second.destroy).toHaveBeenCalledOnce();
});
