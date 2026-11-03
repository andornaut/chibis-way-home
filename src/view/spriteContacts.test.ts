import type { AsepriteSheet } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import maskJson from "../../public/art/contact-silhouettes.json";
import manifestJson from "../../public/art/manifest.json";
import bearSheet from "../../public/art/sprites/bear-antagonist.json";
import { ARCHETYPES } from "../data/archetypes";
import { BIRD } from "../data/bird";
import { CHARACTERS } from "../data/characters";
import { TILE } from "../data/screen";
import type { SpriteSilhouettes, ZoneLayout } from "../data/types";
import { contactBox, startBehaviour, stepBehaviour } from "../rules/behaviour";
import { startBird } from "../rules/bird";
import { contactFrameAt, silhouetteContact, spriteFrameOrigin } from "../rules/bodyContact";
import { objectLayout } from "../rules/tiles";
import { startZone, stepZone } from "../rules/zone";
import { artHitboxes, type ArtManifest, sheetFrameSize } from "./aseprite";
import { behaviourPose } from "./behaviour";
import { spriteContacts } from "./spriteContacts";

const manifest: ArtManifest = {
  backdrops: [],
  data: [],
  fonts: [],
  images: [],
  sprites: [
    { contact: "silhouette", json: "actor.json", key: "actor", once: [], png: "actor.png" },
  ],
  tilesets: [],
};
const sheet: AsepriteSheet = {
  frames: { "actor 0": { duration: 100 } },
  meta: { frameTags: [{ direction: "forward", from: 0, name: "idle", to: 0 }] },
};
const data: SpriteSilhouettes = {
  sprites: { actor: { frames: { "actor 0": [[0, 1, 3]] }, height: 2, width: 4 } },
  version: 1,
};

describe("paired silhouette loading", () => {
  it("resolves exact exported frame names and the existing animation timing", () => {
    expect(
      spriteContacts(
        manifest,
        () => sheet,
        () => ({ height: 2, width: 4 }),
        data,
      ).actor,
    ).toEqual({
      frame: { height: 2, width: 4 },
      frames: data.sprites.actor?.frames,
      tags: { idle: { frames: [{ frame: "actor 0", seconds: 0.1 }], once: false } },
    });
  });
  it.each([
    undefined,
    { sprites: {}, version: 1 },
    { sprites: { actor: { frames: {}, height: 2, width: 4 } }, version: 1 },
  ] as const)("rejects missing masks instead of making the body harmless", (invalid) => {
    expect(() =>
      spriteContacts(
        manifest,
        () => sheet,
        () => ({ height: 2, width: 4 }),
        invalid,
      ),
    ).toThrow();
  });
});

it("validates paired body exports and initializes their active and scene-bound profiles", () => {
  const sheets = import.meta.glob<
    AsepriteSheet & {
      readonly frames: Readonly<
        Record<
          string,
          {
            readonly duration: number;
            readonly sourceSize: { readonly w: number; readonly h: number };
          }
        >
      >;
    }
  >("../../public/art/sprites/*.json", { eager: true, import: "default" });
  const sheet = (key: string) => {
    const value = sheets[`../../public/art/sprites/${key}.json`];
    if (!value) {
      throw new Error(`Missing contact sheet ${key}`);
    }
    return value;
  };
  const actual = manifestJson as ArtManifest;
  const contacts = spriteContacts(actual, sheet, (key) => sheetFrameSize(sheet(key)), maskJson);
  const hitboxes = artHitboxes((key) => sheetFrameSize(sheet(key)), actual, contacts);
  const bird = startBird(BIRD, { x: 0, y: 0 });
  for (const [key, character] of Object.entries(CHARACTERS)) {
    if (!contacts[character.art] || !character.behaviour) {
      continue;
    }
    const object = objectLayout(
      TILE,
      { archetypes: ARCHETYPES, characters: CHARACTERS },
      hitboxes,
      undefined,
      {},
      { character: key, col: 0, row: 0, scene: "intro" },
    );
    for (const actor of [object, { ...object, scene: undefined }]) {
      const state = startBehaviour(BIRD, actor, bird);
      expect(state.active).toBe(actor.scene === undefined);
      expect(contactFrameAt(actor.contact!, state.animationTag!, 0).frame).toBeDefined();
    }
  }
  expect(Object.keys(contacts).sort()).toEqual(
    actual.sprites
      .filter((sprite) => sprite.contact === "silhouette")
      .map((sprite) => sprite.key)
      .sort(),
  );
});

const bearManifest = {
  ...manifestJson,
  sprites: manifestJson.sprites.filter(({ key }) => key === "bear-antagonist"),
} as ArtManifest;
const bearContacts = spriteContacts(
  bearManifest,
  () => bearSheet as AsepriteSheet,
  () => sheetFrameSize(bearSheet),
  maskJson,
);
const bearBody = objectLayout(
  TILE,
  { archetypes: ARCHETYPES, characters: CHARACTERS },
  artHitboxes(() => sheetFrameSize(bearSheet), bearManifest, bearContacts),
  undefined,
  {},
  { character: "bear-antagonist", col: 20, row: 20 },
);

it.each([
  { first: 8, milliseconds: 120, tag: "walk", top: [4, 3, 4, 3] },
  { first: 12, milliseconds: 80, tag: "rush", top: [4, 3, 4, 3] },
])(
  "uses actual $tag silhouettes, native feet and mirrored contact for every locomotion frame",
  ({ first, milliseconds, tag, top }) => {
    expect(bearBody).toMatchObject({
      height: 48,
      hitbox: { height: 46, width: 44, x: 2, y: 2 },
      width: 48,
    });
    expect(bearBody.contact).toBe(bearContacts["bear-antagonist"]);
    const stateKey = Object.keys(bearBody.behaviour!.states).find(
      (key) => bearBody.behaviour!.states[key]!.animation === tag,
    )!;
    expect(stateKey).toBeDefined();
    const selected = startBehaviour(
      BIRD,
      { ...bearBody, behaviour: { ...bearBody.behaviour!, initial: stateKey } },
      startBird(BIRD, { x: 0, y: 0 }),
    );
    expect(selected.animationTag).toBe(tag);
    for (const facing of [-1, 1] as const) {
      const pose = behaviourPose(bearBody, { ...selected, facing });
      expect(pose).toEqual({ animation: tag, flipX: facing === -1 });
      for (let frame = 0; frame < 4; frame++) {
        const active = contactFrameAt(
          bearBody.contact!,
          tag,
          ((frame + 0.5) * milliseconds) / 1000,
        ).frame;
        expect(active).toBe(`bear-antagonist ${first + frame}.aseprite`);
        const runs = bearBody.contact!.frames[active]!;
        expect([
          Math.min(...runs.map((run) => run[1])),
          Math.min(...runs.map((run) => run[0])),
          Math.max(...runs.map((run) => run[2])),
          Math.max(...runs.map((run) => run[0])) + 1,
        ]).toEqual([2, top[frame], 45, 48]);
        const at = { x: 240.2, y: 240.2 };
        const origin = spriteFrameOrigin(bearBody.contact!.frame, bearBody, at);
        expect(origin).toEqual({ x: 240, y: 240 });
        expect(origin.y + Math.max(...runs.map((run) => run[0])) + 1).toBe(
          Math.round(at.y + bearBody.height),
        );
        const foot = runs.find((run) => run[0] === 47)!;
        const footX = facing === 1 ? foot[1] : 48 - foot[2];
        const inside = { height: 0.5, width: 0.5, x: origin.x + footX + 0.25, y: origin.y + 47.25 };
        const above = { height: 0.5, width: 48, x: origin.x, y: origin.y + top[frame]! - 1 };
        expect(silhouetteContact(bearBody, active, pose.flipX, at, at, inside, inside)).toBe(true);
        expect(silhouetteContact(bearBody, active, pose.flipX, at, at, above, above)).toBe(false);
      }
    }
  },
);

it.each(["walk", "rush"] as const)(
  "uses the actual %s mask in zone death resolution above and inside the back",
  (tag) => {
    const body = {
      ...bearBody,
      behaviour: {
        axis: "x" as const,
        distance: 0,
        initial: "pose",
        states: { pose: { animation: tag, motion: { kind: "wait" as const }, transitions: [] } },
      },
    };
    const layout: ZoneLayout = {
      areas: {
        main: {
          backX: 0,
          chunks: [],
          entries: { start: { x: 100, y: 100 } },
          exitX: 900,
          height: 720,
          objects: [body],
          solids: [{ height: 12, width: 1000, x: 0, y: 288 }],
          terrain: [],
          tileset: undefined,
          width: 1000,
        },
      },
      birdFrame: { height: 42, width: 48 },
      start: { area: "main", entry: "start" },
    };
    const initial = startZone(BIRD, layout, 1);
    const first = bearBody.contact!.tags[tag]!.frames[0]!.frame;
    const top = Math.min(...bearBody.contact!.frames[first]!.map(([y]) => y));
    for (const facing of [-1, 1] as const) {
      for (const lethal of [false, true]) {
        const state = {
          ...initial,
          behaviours: initial.behaviours.map((value) => ({ ...value!, facing })),
          bird: {
            ...initial.bird,
            x: bearBody.origin.x + 24 - BIRD.width / 2,
            y: bearBody.origin.y - BIRD.height + (lethal ? 30 : top - 1),
          },
        };
        const next = stepZone(
          BIRD,
          layout,
          1 / 120,
          { jumpHeld: false, move: 0, useHeld: false },
          state,
        );
        expect(next.death !== undefined).toBe(lethal);
        expect(next.objects[0]!.y + body.height).toBe(288);
      }
    }
  },
);

const anticipationSheets = import.meta.glob<AsepriteSheet & Parameters<typeof sheetFrameSize>[0]>(
  "../../public/art/sprites/*.json",
  { eager: true, import: "default" },
);
const anticipationSheet = (key: string) => {
  const value = anticipationSheets[`../../public/art/sprites/${key}.json`];
  if (!value) {
    throw new Error(`Missing anticipation sheet ${key}`);
  }
  return value;
};
const anticipationContacts = spriteContacts(
  manifestJson as ArtManifest,
  anticipationSheet,
  (key) => sheetFrameSize(anticipationSheet(key)),
  maskJson,
);
const anticipationHitboxes = artHitboxes(
  (key) => sheetFrameSize(anticipationSheet(key)),
  manifestJson as ArtManifest,
  anticipationContacts,
);

it.each([
  "bear-antagonist",
  "dog-antagonist",
  "ferret-antagonist",
  "goose-antagonist",
  "pigeon-antagonist",
  "raccoon-antagonist",
])(
  "uses actual %s anticipation alpha for the authoritative clock and mirrored swept contact",
  (key) => {
    const resolved = objectLayout(
      TILE,
      { archetypes: ARCHETYPES, characters: CHARACTERS },
      anticipationHitboxes,
      undefined,
      {},
      { character: key, col: 20, row: 20 },
    );
    const tell = Object.entries(resolved.behaviour!.states).find(
      ([, node]) =>
        node.attack?.phase === "tell" && (node.track?.axis ?? resolved.behaviour!.axis) === "x",
    )!;
    const object = { ...resolved, behaviour: { ...resolved.behaviour!, initial: tell[0] } };
    const bird = startBird(BIRD, { x: 0, y: 0 });
    const start = startBehaviour(BIRD, object, bird);
    const step = stepBehaviour(BIRD, object, [], 0.55, bird, object.origin, start);
    const cue = object.contact!.tags["anticipate-lift"]!;
    expect(step.at).toEqual(object.origin);
    expect(step.state.animationTag).toBe("anticipate-lift");
    expect(step.state.animationSeconds).toBeCloseTo(0.55);
    expect([...new Set(step.segments.map(({ frame }) => frame))]).toEqual(
      cue.frames.map(({ frame }) => frame),
    );
    expect(
      contactFrameAt(object.contact!, step.state.animationTag!, step.state.animationSeconds!).frame,
    ).toBe(cue.frames.at(-1)!.frame);
    const at = { x: 240, y: 240 };
    const origin = spriteFrameOrigin(object.contact!.frame, object, at);
    for (const facing of [-1, 1] as const) {
      expect(behaviourPose(object, { ...step.state, facing })).toEqual({
        animation: "anticipate-lift",
        flipX: facing === -1,
      });
      const reach = contactBox(object, at, facing, "x");
      for (const { frame } of cue.frames) {
        const runs = object.contact!.frames[frame]!;
        const left = Math.min(
          ...runs.map((run) => (facing === 1 ? run[1] : object.contact!.frame.width - run[2])),
        );
        const right = Math.max(
          ...runs.map((run) => (facing === 1 ? run[2] : object.contact!.frame.width - run[1])),
        );
        expect(origin.x + left).toBeGreaterThanOrEqual(reach.x);
        expect(origin.x + right).toBeLessThanOrEqual(reach.x + reach.width);
        expect(origin.y + Math.min(...runs.map(([y]) => y))).toBeGreaterThanOrEqual(reach.y);
        expect(origin.y + Math.max(...runs.map(([y]) => y)) + 1).toBeLessThanOrEqual(
          reach.y + reach.height,
        );
        const [y, x] = runs[0]!;
        const opaque = {
          height: 0.5,
          width: 0.5,
          x: origin.x + (facing === 1 ? x : object.contact!.frame.width - x - 1) + 0.25,
          y: origin.y + y + 0.25,
        };
        const clear = { height: 0.5, width: 0.5, x: origin.x + 0.25, y: origin.y + 0.25 };
        expect(silhouetteContact(object, frame, facing === -1, at, at, opaque, opaque)).toBe(true);
        expect(silhouetteContact(object, frame, facing === -1, at, at, clear, clear)).toBe(false);
        const travel = 2 * object.contact!.frame.width;
        const crossing = { ...opaque, x: opaque.x + travel / 2 };
        const end = { ...at, x: at.x + travel };
        expect(silhouetteContact(object, frame, facing === -1, at, at, crossing, crossing)).toBe(
          false,
        );
        expect(silhouetteContact(object, frame, facing === -1, end, end, crossing, crossing)).toBe(
          false,
        );
        expect(silhouetteContact(object, frame, facing === -1, at, end, crossing, crossing)).toBe(
          true,
        );
      }
    }
  },
);
