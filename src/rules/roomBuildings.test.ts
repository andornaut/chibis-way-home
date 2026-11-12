import { expect, it } from "vitest";

import manifest from "../../public/art/manifest.json" with { type: "json" };
import platforming from "../../public/art/tilesets/tiles-platforming.json" with { type: "json" };
import { ARCHETYPES } from "../data/archetypes.ts";
import { CHARACTERS } from "../data/characters.ts";
import { CHUNKS, THEMES } from "../data/chunks.ts";
import { ROOM_BUILDING_DOOR, ROOM_BUILDINGS } from "../data/roomBuildings.ts";
import { ZONE_ROWS } from "../data/screen.ts";
import type { ZonePlan } from "../data/types/index.ts";
import { bindElement } from "./elementBinding.ts";
import { withRoomBuildings } from "./roomBuildings.ts";
import { zoneLayout } from "./tiles.ts";

const library = { characters: CHARACTERS };
const plan: ZonePlan = {
  areas: {
    main: {
      cols: 60,
      entries: { start: { col: 2, row: 50 } },
      objects: [
        { character: "street-door", col: 17, room: "gift", row: 43 },
        { character: "red-edge-top", col: 40, row: 50 },
      ],
      rows: 60,
      solids: [
        { col: 0, cols: 20, row: 50, rows: 10 },
        { col: 20, cols: 40, row: 48, rows: 12 },
      ],
    },
  },
  start: { area: "main", entry: "start" },
};

it("appends native nonphysical world scenery without changing the complete prior object prefix or solids", () => {
  const before = structuredClone(plan);
  const painted = withRoomBuildings(library, { main: "street" }, plan);
  expect(plan).toEqual(before);
  const area = painted.areas.main!;
  expect(area.objects.slice(0, 2)).toEqual(plan.areas.main!.objects);
  expect(area.objects[2]).toEqual({
    character: ROOM_BUILDINGS.street,
    col: 12,
    parallax: { x: 1, y: 1 },
    row: 35,
  });
  expect(area.sceneryIndices).toEqual([2]);
  expect(area.solids).toBe(plan.areas.main!.solids);
  const resolved = zoneLayout(
    12,
    { height: 42, width: 48 },
    { archetypes: ARCHETYPES, characters: CHARACTERS },
    {},
    { "tiles-platforming": platforming },
    new Set(),
    painted,
  );
  const building = resolved.areas.main!.objects[2]!;
  expect(building).toMatchObject({
    collision: "none",
    height: 180,
    interaction: { kind: "none" },
    origin: { x: 144, y: 420 },
    parallax: { x: 1, y: 1 },
    scenerySource: "chunk",
    width: 180,
  });
  expect(manifest.backdrops.find(({ key }) => key === building.art)).toMatchObject({
    height: 180,
    repeat: "none",
    width: 180,
  });
});
it("does not add exterior buildings to interiors or resize park/test entrances", () => {
  expect(withRoomBuildings(library, { main: "apartment-lobby" }, plan)).toBe(plan);
  for (const character of ["park-gate", "test-door"]) {
    const prototype = {
      ...plan,
      areas: {
        main: { ...plan.areas.main!, objects: [{ ...plan.areas.main!.objects[0]!, character }] },
      },
    };
    expect(withRoomBuildings(library, { main: "street" }, prototype)).toBe(prototype);
  }
});
it("rejects a facade whose full base crosses a gap even when its complete door stands on terrain", () => {
  const narrow = {
    ...plan,
    areas: { main: { ...plan.areas.main!, solids: [{ col: 17, cols: 5, row: 50, rows: 10 }] } },
  };
  expect(() => withRoomBuildings(library, { main: "street" }, narrow)).toThrow(
    "base 12..27 row 50, gap at 12",
  );
});
it("checks the actual full-base support of every authored ordinary-door slot without assembling a stage", () => {
  const problems: string[] = [];
  let checked = 0;
  for (const [id, chunk] of Object.entries(CHUNKS)) {
    for (const theme of typeof chunk.theme === "string" ? [chunk.theme] : chunk.theme) {
      if (!ROOM_BUILDINGS[theme]) {
        continue;
      }
      const configuration = THEMES[theme]!;
      const door = bindElement(configuration.bindings, {
        character: "",
        col: 0,
        role: configuration.door,
        row: 0,
      });
      if (door.character !== ROOM_BUILDING_DOOR) {
        continue;
      }
      for (const slot of chunk.slots ?? []) {
        if (slot.kind !== "door") {
          continue;
        }
        const size = CHARACTERS[door.character]!;
        const placed = {
          ...door,
          col: slot.area.col + (slot.area.cols - size.cols) / 2,
          room: "gift",
          row: slot.area.row + slot.area.rows - size.rows,
        };
        const candidate: ZonePlan = {
          areas: {
            main: {
              chunks: [{ chunk: id, col: 0, cols: chunk.cols }],
              cols: chunk.cols,
              entries: {},
              objects: [placed],
              rows: chunk.rows ?? ZONE_ROWS,
              solids: chunk.solids,
            },
          },
          start: { area: "main", entry: "start" },
        };
        try {
          withRoomBuildings(library, { main: theme }, candidate);
        } catch (error) {
          problems.push(`${id}/${slot.id}: ${String(error)}`);
        }
        checked++;
      }
    }
  }
  expect(checked).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});
