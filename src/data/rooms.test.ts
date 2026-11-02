import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import type { ArtManifest } from "../view/aseprite";
import { CHARACTERS } from "./characters";
import { DIALOGUES, SPEAKERS } from "./dialogues";
import { ZONE_MAP } from "./map";
import { ROOMS } from "./rooms";
import { TEXT } from "./text";
import type { SkillId } from "./types";
import { RECIPES } from "./zones";

const MANIFEST = manifestJson as ArtManifest;
const SHEETS = import.meta.glob<AsepriteSheet>("../../public/art/sprites/*.json", {
  eager: true,
  import: "default",
});
const tagsOf = (art: string) => {
  const sheet = SHEETS[`../../public/art/sprites/${art}.json`];
  return sheet ? [...sheetTags(sheet).keys()] : [];
};
const BACKDROPS = new Set(MANIFEST.backdrops.map(({ key }) => key));

describe.each(Object.entries(ROOMS))("room %s", (key, room) => {
  it("has a name", () => {
    expect(TEXT.rooms[key]?.name, `TEXT.rooms.${key}.name`).toBeDefined();
  });

  it("draws a backdrop art has, if any", () => {
    if (room.art !== undefined) {
      expect(BACKDROPS.has(room.art), room.art).toBe(true);
    }
  });

  it("plays only tags art has, of characters that exist", () => {
    const missing = [
      ...(room.animations ?? []).flatMap(({ art, tag }) =>
        tagsOf(art).includes(tag) ? [] : [`${art}:${tag}`],
      ),
      ...(room.cast ?? []).flatMap(({ character }) =>
        character in CHARACTERS ? [] : [`character ${character}`],
      ),
    ];
    expect(missing).toEqual([]);
  });
});

describe("the rooms' words", () => {
  it("name only rooms that exist", () => {
    expect(Object.keys(TEXT.rooms).filter((key) => !(key in ROOMS))).toEqual([]);
  });
});

describe.each(Object.entries(ROOMS).filter(([, room]) => room.grant !== undefined))(
  "skill gift room %s",
  (_key, room) => {
    it("connects its grant to skill details and a supported entry speaker", () => {
      expect(TEXT.skills[room.grant!].title).not.toBe("");
      expect(TEXT.skills[room.grant!].description).not.toBe("");
      const entry = DIALOGUES[room.enter!];
      expect(entry).toBeDefined();
      expect(entry!.lines.length).toBeGreaterThan(0);
      for (const line of entry!.lines) {
        expect(TEXT.lines[line.line]).toBeDefined();
        expect(TEXT.dialogue.speakers[line.speaker]).toBeDefined();
        const speaker = SPEAKERS[line.speaker];
        expect(speaker).toBeDefined();
        expect(MANIFEST.sprites.some(({ key }) => key === speaker!.portrait)).toBe(true);
      }
    });
  },
);

it("repeats the three skill gifts through existing catalogue doors", () => {
  const order: readonly SkillId[] = ["dash", "doubleJump", "speedy"];
  const grants = { dash: 0, doubleJump: 0, speedy: 0 };
  for (const destination of ZONE_MAP.destinations) {
    destination.stages.forEach((stage, index) => {
      const recipe = RECIPES[stage]!;
      const doors =
        "sections" in recipe ? recipe.sections.flatMap(({ doors }) => doors) : recipe.doors;
      expect(doors, stage).toHaveLength(1);
      expect(doors[0]!.count, stage).toBe(1);
      const grant = ROOMS[doors[0]!.room]?.grant;
      expect(grant, stage).toBe(order[index % order.length]);
      grants[grant!]++;
    });
  }
  expect(grants).toEqual({ dash: 7, doubleJump: 7, speedy: 7 });
});
