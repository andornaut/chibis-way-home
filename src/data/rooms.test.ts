import { describe, expect, it } from "vitest";

import manifestJson from "../../public/art/manifest.json";
import type { ArtManifest } from "../assets";
import { DIALOGUES, SPEAKERS } from "./dialogues";
import { ZONE_MAP } from "./map";
import { ROOMS } from "./rooms";
import { TEXT } from "./text";
import type { SkillId } from "./types";
import { RECIPES } from "./zones";

const MANIFEST = manifestJson as ArtManifest;
describe.each(Object.entries(ROOMS))("room %s", (key) => {
  it("has a name", () => {
    expect(TEXT.rooms[key]?.name, `TEXT.rooms.${key}.name`).toBeDefined();
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
