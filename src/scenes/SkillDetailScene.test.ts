import { beforeEach, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ close: vi.fn() }));
vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("./modalInput", () => ({ modalInput: () => gate }));

import { SkillDetailScene } from "./SkillDetailScene";

beforeEach(() => vi.clearAllMocks());
it("closes only after backdrop readiness and notifies its opener once", () => {
  const onClose = vi.fn(),
    stop = vi.fn();
  const scene = Object.assign(new SkillDetailScene(), { scene: { stop } }) as unknown as {
    init(data: { onClose: () => void; skill: "dash" }): void;
    close(): void;
    ready: boolean;
  };
  scene.init({ onClose, skill: "dash" });
  scene.close();
  expect(stop).not.toHaveBeenCalled();
  scene.ready = true;
  scene.close();
  scene.close();
  expect(stop).toHaveBeenCalledOnce();
  expect(gate.close).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
  expect(gate.close.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]!);
});

it("ignores a previous visit's delayed capture instead of enabling the current card early", () => {
  const oldClose = vi.fn(),
    onClose = vi.fn();
  const scene = Object.assign(new SkillDetailScene(), {
    scene: { stop: vi.fn() },
    sys: { isActive: () => true },
  }) as unknown as {
    init(data: { onClose: () => void; skill: "dash" }): void;
    close(): void;
    visit: number;
    backdropReady(visit: number): void;
  };
  scene.init({ onClose: oldClose, skill: "dash" });
  const oldVisit = scene.visit;
  scene.init({ onClose, skill: "dash" });
  scene.backdropReady(oldVisit);
  scene.close();
  expect(onClose).not.toHaveBeenCalled();
  scene.backdropReady(scene.visit);
  scene.close();
  expect(onClose).toHaveBeenCalledOnce();
  expect(oldClose).not.toHaveBeenCalled();
});
