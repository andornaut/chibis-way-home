import { EventEmitter } from "node:events";

import type { Scene } from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAMERA } from "../data/camera.ts";
import { CONTACT_CUE } from "../data/feedback.ts";
import { SCREEN } from "../data/screen.ts";
import { contactOverscan } from "../ui/index.ts";
import { cancelContactFeedback, playContactFeedback } from "./contactFeedback.ts";

vi.mock("./scenePalette.ts", () => ({ paletteColour: () => 1 }));
const shake = CAMERA.contactShake!;
class Snapshot {}
afterEach(() => vi.unstubAllGlobals());

// The view at a fractional zoom, 64 device pixels in from the canvas's left.
const ZOOM = 390 / 180;
function fixture() {
  vi.stubGlobal("HTMLImageElement", Snapshot);
  const events = new EventEmitter();
  const camera = {
    height: Math.round(SCREEN.height * ZOOM),
    scrollX: 80,
    scrollY: 90,
    setScroll(x: number, y: number) {
      this.scrollX = x;
      this.scrollY = y;
    },
    width: Math.round(SCREEN.width * ZOOM),
    x: 64,
    y: 0,
    zoom: ZOOM,
  };
  const hud = {
    setScroll: vi.fn(),
    setVisible(value: boolean) {
      this.visible = value;
    },
    visible: true,
  };
  const loop = { time: 1000 };
  let captured!: (snapshot: Snapshot) => void;
  const texture = { add: vi.fn() };
  const keys = new Set<string>();
  const textures = {
    addImage: vi.fn((key: string) => {
      keys.add(key);
      return texture;
    }),
    exists: (key: string) => keys.has(key),
    remove: vi.fn((key: string) => keys.delete(key)),
  };
  const images: { destroy: ReturnType<typeof vi.fn>; setPosition: ReturnType<typeof vi.fn> }[] = [];
  const graphic = {
    clear: vi.fn(),
    destroy: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: vi.fn(),
    setDepth() {
      return this;
    },
    setScrollFactor() {
      return this;
    },
  };
  const scene = {
    add: {
      graphics: vi.fn(() => graphic),
      image: vi.fn(() => {
        const image = {
          destroy: vi.fn(),
          setDepth() {
            return this;
          },
          setDisplaySize() {
            return this;
          },
          setOrigin() {
            return this;
          },
          setPosition: vi.fn(),
          setScrollFactor() {
            return this;
          },
        };
        images.push(image);
        return image;
      }),
    },
    cameras: { main: camera },
    events,
    game: {
      loop,
      renderer: {
        snapshotArea: vi.fn(
          (
            _x: number,
            _y: number,
            _w: number,
            _h: number,
            callback: (snapshot: Snapshot) => void,
          ) => {
            captured = callback;
          },
        ),
      },
      scene: { getScenes: () => [{ cameras: { cameras: [camera, hud] } }] },
    },
    textures,
  } as unknown as Scene;
  return {
    camera,
    capture: () => captured(new Snapshot()),
    events,
    graphic,
    hud,
    images,
    loop,
    scene,
    texture,
    textures,
  };
}

const options = { cue: CONTACT_CUE, depth: 2, reducedMotion: false, shake };

describe("world-only red contact feedback", () => {
  it("copies eight world edges, offsets only the world camera and fully restores after the effect", () => {
    const f = fixture();
    playContactFeedback(f.scene, options);
    expect(f.hud.visible).toBe(false);
    f.capture();
    expect(f.hud.visible).toBe(true);
    expect(f.texture.add).toHaveBeenCalledTimes(8);
    expect(f.camera.scrollX).toBe(80 - shake.distance);
    expect(f.camera.scrollY).toBe(90 - shake.distance);
    expect(f.hud.setScroll).not.toHaveBeenCalled();
    f.loop.time += shake.secondOnMs;
    f.events.emit("postupdate");
    expect(f.camera.scrollX).toBe(80 + shake.distance);
    f.loop.time = 1000 + Math.max(shake.durationMs, CONTACT_CUE.durationMs);
    f.events.emit("postupdate");
    expect(f.camera).toMatchObject({ scrollX: 80, scrollY: 90 });
    expect(f.images.every((image) => image.destroy.mock.calls.length === 1)).toBe(true);
    expect(f.graphic.destroy).toHaveBeenCalledOnce();
    expect(f.textures.remove).toHaveBeenCalledOnce();
    expect(f.events.listenerCount("postupdate")).toBe(0);
  });

  it("snapshots the view's device pixels and cuts each edge at the camera's zoom", () => {
    const f = fixture();
    playContactFeedback(f.scene, options);
    f.capture();
    const { height, width, x, y } = f.camera;
    expect(f.scene.game.renderer.snapshotArea).toHaveBeenCalledWith(
      x,
      y,
      width,
      height,
      expect.any(Function),
    );
    const device = (value: number) => Math.round(value * ZOOM);
    expect(f.texture.add.mock.calls.map((call) => call.slice(2))).toEqual(
      contactOverscan(shake.distance, { ...SCREEN, x: 0, y: 0 }).map(({ source }) => [
        device(source.x),
        device(source.y),
        device(source.x + source.width) - device(source.x),
        device(source.y + source.height) - device(source.y),
      ]),
    );
    f.events.emit("shutdown");
  });

  it("keeps a static cue with reduced motion, and ignores captures completed after cancellation", () => {
    const still = fixture();
    playContactFeedback(still.scene, { ...options, reducedMotion: true });
    expect(still.scene.game.renderer.snapshotArea).not.toHaveBeenCalled();
    expect(still.camera).toMatchObject({ scrollX: 80, scrollY: 90 });
    still.loop.time += shake.firstOffMs;
    still.graphic.fillRect.mockClear();
    still.events.emit("postupdate");
    expect(still.graphic.fillRect).toHaveBeenCalled();
    still.events.emit("shutdown");
    expect(still.graphic.destroy).toHaveBeenCalledOnce();
    const pending = fixture();
    playContactFeedback(pending.scene, options);
    cancelContactFeedback(pending.events as unknown as Scene["events"]);
    pending.hud.visible = false;
    pending.capture();
    expect(pending.hud.visible).toBe(false);
    expect(pending.textures.addImage).not.toHaveBeenCalled();
    expect(pending.images).toEqual([]);
  });
});
