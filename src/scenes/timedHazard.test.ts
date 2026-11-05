import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import palette from "../../public/art/palette.json";
import { BIRD } from "../data/bird";
import { HAZARD_PHASE_STYLE } from "../data/hazardPhaseStyle";
import { WARNED_VENT_BEHAVIOUR, WARNED_VENT_SECONDS } from "../data/obstacleBehaviours";
import type { Archetype, ObjectLayout, Rect } from "../data/types";
import { startBehaviour, stepBehaviour } from "../rules/behaviour";
import { startBird } from "../rules/bird";
import { effectiveCollision } from "../rules/effectiveCollision";
import { objectLayout } from "../rules/tiles";
import { timedHazardRect } from "../rules/timedHazard";
import { createPhaseTileArt, createTimedHazardArt } from "./timedHazard";

vi.mock("phaser", () => ({ Scene: class {}, Scenes: { Events: { PRE_RENDER: "prerender" } } }));
vi.mock("../ui/input/frameTurn", () => ({ FRAME_TURN: {} }));

import { ZoneScene } from "./ZoneScene";

const colour = (name: string) =>
  Number.parseInt(palette.colours[name as keyof typeof palette.colours].slice(1), 16);
function graphics() {
  let fill = 0,
    alpha = 0;
  const painted: { alpha: number; colour: number; rect: Rect }[] = [];
  const item = {
    clear: vi.fn(() => {
      painted.length = 0;
      return item;
    }),
    destroy: vi.fn(),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) => {
      painted.push({ alpha, colour: fill, rect: { height, width, x, y } });
      return item;
    }),
    fillStyle: vi.fn((value: number, opacity: number) => {
      fill = value;
      alpha = opacity;
      return item;
    }),
    setDepth: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
  };
  const pixel = (x: number, y: number) =>
    [...painted]
      .reverse()
      .find(
        ({ rect }) =>
          x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height,
      )?.colour;
  return { item, painted, pixel };
}

it("paints neutral recovery, inset amber warning and the full active red contact rectangle", () => {
  const art = graphics();
  const painter = createTimedHazardArt(0, colour, {
    add: { graphics: () => art.item },
  } as unknown as Scene);
  const rect = { height: 36, width: 24, x: 10.25, y: 20.5 };
  painter.draw("inactive", rect);
  expect(art.painted).toEqual([
    { alpha: 1, colour: colour(HAZARD_PHASE_STYLE.inactive), rect: { ...rect, x: 0, y: 0 } },
  ]);
  painter.draw("warning", rect);
  const width = HAZARD_PHASE_STYLE.warningWidth;
  expect(art.pixel(width / 2, rect.height / 2)).toBe(colour(HAZARD_PHASE_STYLE.warning));
  expect(art.pixel(rect.width - width / 2, rect.height / 2)).toBe(
    colour(HAZARD_PHASE_STYLE.warning),
  );
  expect(art.pixel(rect.width / 2, width / 2)).toBe(colour(HAZARD_PHASE_STYLE.warning));
  expect(art.pixel(rect.width / 2, rect.height - width / 2)).toBe(
    colour(HAZARD_PHASE_STYLE.warning),
  );
  expect(art.pixel(rect.width / 2, rect.height / 2)).toBe(colour(HAZARD_PHASE_STYLE.inactive));
  expect(art.pixel(-0.5, 0)).toBeUndefined();
  for (const paint of art.painted) {
    expect(paint.alpha).toBe(1);
    expect(paint.rect.x).toBeGreaterThanOrEqual(0);
    expect(paint.rect.y).toBeGreaterThanOrEqual(0);
    expect(paint.rect.x + paint.rect.width).toBeLessThanOrEqual(rect.width);
    expect(paint.rect.y + paint.rect.height).toBeLessThanOrEqual(rect.height);
  }
  painter.draw("active", rect);
  expect(art.painted).toEqual([
    { alpha: 1, colour: colour(HAZARD_PHASE_STYLE.active), rect: { ...rect, x: 0, y: 0 } },
  ]);
  painter.draw("inactive", rect);
  expect(art.pixel(rect.width / 2, rect.height / 2)).toBe(colour(HAZARD_PHASE_STYLE.inactive));
  painter.draw("warning", { ...rect, width: 6 });
  expect(art.pixel(3, rect.height / 2)).toBe(colour(HAZARD_PHASE_STYLE.warning));
  expect(
    art.painted.every(
      ({ rect: paint }) => paint.width >= 0 && paint.height >= 0 && paint.x + paint.width <= 6,
    ),
  ).toBe(true);
  expect(art.item.setPosition).toHaveBeenLastCalledWith(rect.x, rect.y);
  expect(art.item.setScrollFactor).toHaveBeenCalledWith(1, 1);
});

function fixture() {
  const archetype: Archetype = {
    collision: "hazard",
    interaction: { kind: "none", range: 0 },
    motion: {
      algorithm: "static",
      direction: "right",
      distance: 0,
      hopHeight: 0,
      pause: 0,
      speed: 0,
      variance: 0,
    },
    reaction: { kind: "none", range: 0, speed: 0 },
  };
  const object: ObjectLayout = {
    ...objectLayout(
      1,
      {
        archetypes: { hazard: archetype },
        characters: {
          vent: {
            archetype: "hazard",
            art: "placeholder-hazard",
            behaviour: WARNED_VENT_BEHAVIOUR,
            cols: 24,
            rows: 36,
          },
        },
      },
      {},
      undefined,
      {},
      { character: "vent", col: 10, row: 20 },
    ),
    hitbox: { height: 4, width: 4, x: 6, y: 6 },
  };
  const art = graphics();
  const bird = startBird(BIRD, { x: 0, y: 0 });
  const initial = startBehaviour(BIRD, object, bird);
  const zone = {
    area: "main",
    attempt: 0,
    behaviours: [initial],
    bird,
    objects: [{ x: 10.25, y: 20.5 }],
  };
  const area = {
    height: 720,
    objects: [object],
    solids: [],
    terrain: [],
    tileset: undefined,
    width: 720,
  };
  const scene = Object.assign(Object.create(ZoneScene.prototype), {
    add: { graphics: vi.fn(() => art.item), rectangle: vi.fn(), sprite: vi.fn() },
    areaArt: graphics().item,
    cache: { json: { get: () => palette } },
    cameras: { main: { setBackgroundColor: vi.fn(), setBounds: vi.fn() } },
    chunkBackdrops: [],
    drawPulses: vi.fn(),
    drawTransients: vi.fn(),
    layout: { areas: { main: area } },
    objectArt: [],
    pulseArt: new Map(),
    pulseSpans: new Map(),
    removalArt: new Map(),
    scenerySprites: [],
    transientArt: new Map(),
    zone,
  });
  scene.objectArt = [scene.drawObject(undefined, undefined, object, 0)];
  return { area, art, bird, initial, object, scene, zone };
}

it("consumes the authoritative graph phase and full producer collider in the live object renderer", () => {
  const { art, bird, initial, object, scene, zone } = fixture();
  expect(scene.objectArt[0].sprite).toBeUndefined();
  expect(scene.add.rectangle).not.toHaveBeenCalled();
  expect(scene.add.sprite).not.toHaveBeenCalled();
  const activeStart = WARNED_VENT_SECONDS.inactive + WARNED_VENT_SECONDS.warning;
  for (const [seconds, expected, collision] of [
    [0, HAZARD_PHASE_STYLE.inactive, "none"],
    [WARNED_VENT_SECONDS.inactive, HAZARD_PHASE_STYLE.warning, "none"],
    [activeStart, HAZARD_PHASE_STYLE.active, "hazard"],
    [activeStart + WARNED_VENT_SECONDS.active, HAZARD_PHASE_STYLE.inactive, "none"],
  ] as const) {
    const state = stepBehaviour(BIRD, object, [], seconds, bird, object.origin, initial).state;
    zone.behaviours[0] = state;
    const before = JSON.stringify(state);
    scene.drawObjects();
    scene.drawObjects();
    expect(JSON.stringify(state)).toBe(before);
    expect(art.pixel(0, 0)).toBe(colour(expected));
    expect(art.item.setPosition).toHaveBeenLastCalledWith(zone.objects[0]!.x, zone.objects[0]!.y);
    expect(art.painted[0]!.rect).toMatchObject({ height: object.height, width: object.width });
    expect(effectiveCollision(object, state)).toBe(collision);
    expect(timedHazardRect(object, zone.objects[0]!)).toEqual({
      ...zone.objects[0],
      height: object.height,
      width: object.width,
    });
  }
  zone.behaviours[0] = initial;
  scene.drawObjects();
  expect(art.pixel(0, 0)).toBe(colour(HAZARD_PHASE_STYLE.inactive));
});

it("replaces the timed object painter through the existing area and retry lifecycle", () => {
  const { art, initial, scene, zone } = fixture();
  const replacement = graphics();
  scene.add.graphics.mockReturnValue(replacement.item);
  scene.drawArea();
  expect(art.item.destroy).toHaveBeenCalledOnce();
  expect(scene.objectArt[0].item).toBe(replacement.item);
  zone.behaviours[0] = initial;
  scene.drawObjects();
  expect(replacement.pixel(0, 0)).toBe(colour(HAZARD_PHASE_STYLE.inactive));
  expect(art.item.destroy).toHaveBeenCalledOnce();
});

it("shows only the current phase's tiles of a tile-skinned timed hazard", () => {
  const image = (key: string, index: number) => {
    const made = { index, key, visible: true, x: 0, y: 0 } as Record<string, unknown>;
    made.setOrigin = () => made;
    made.setVisible = (visible: boolean) => {
      made.visible = visible;
      return made;
    };
    return made;
  };
  const container = {
    setDepth: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
  };
  const scene = {
    add: {
      container: vi.fn(() => container),
      image: vi.fn((_x: number, _y: number, key: string, index: number) => image(key, index)),
    },
  } as unknown as Scene;
  const at = (index: number) => [{ col: 0, index, row: 0 }];
  const painter = createPhaseTileArt(
    3,
    "tiles-street",
    { active: at(2), inactive: at(0), warning: at(1) },
    scene,
  );
  const images = vi
    .mocked(scene.add.image)
    .mock.results.map(({ value }) => value as { index: number; visible: boolean });
  for (const [phase, index] of [
    ["inactive", 0],
    ["warning", 1],
    ["active", 2],
  ] as const) {
    painter.draw(phase, { height: 12, width: 12, x: 5, y: 7 });
    expect(images.filter(({ visible }) => visible).map(({ index: i }) => i)).toEqual([index]);
  }
  expect(container.setPosition).toHaveBeenLastCalledWith(5, 7);
  expect(container.setDepth).toHaveBeenCalledWith(3);
});
