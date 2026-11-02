import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { STAGE_PREVIEWS } from "../data/stagePreviews";
import { STATS_SCOPE_TEXT, TEXT } from "../data/text";

vi.mock("./cardParts", () => ({
  BODY_FONT: "font-body",
  TITLE_FONT: "font-title",
  addCardText: (_scene: unknown, _font: string, _point: unknown, text: string) => {
    paintedText.push(text);
    return { setLeftAlign: () => ({ setLineSpacing: vi.fn() }) };
  },
  cardFonts: () => ({ body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) }),
  paletteColour: (_scene: unknown, colour: string) => colour,
}));

import { addStageSummary } from "./runStatsParts";

const paintedText: string[] = [];

it("paints current-stage results and aggregate totals without background fills", () => {
  paintedText.length = 0;
  const destination = ZONE_MAP.destinations[0]!;
  const stage = destination.stages[0]!;
  const rectangle = vi.fn(() => ({ setOrigin: vi.fn() }));
  const image = vi.fn(() => ({ setOrigin: () => ({ setDisplaySize: vi.fn() }) }));
  const scene = {
    add: { image, rectangle },
    cache: { json: { get: () => ({ [destination.id]: { primary: "zone-yellow" } }) } },
    textures: { exists: () => true },
  } as unknown as Scene;
  const runStats = { attemptSeconds: 30, attempts: 2, bestSeconds: 20, runSeconds: 50 };
  const data = {
    percent: 1,
    runStats,
    stage,
    wholeRun: { activeSeconds: 123456, completed: 19, deaths: 9876, total: 21 },
    zoneStats: { ...runStats, completed: 1, partial: true, total: 3 },
  };
  const unchanged = structuredClone(data);
  const layout = addStageSummary(scene, { height: 164, width: 688, x: 16, y: 112 }, data);
  expect(image).toHaveBeenCalledExactlyOnceWith(244, 128, STAGE_PREVIEWS[stage]);
  expect(rectangle.mock.calls).toEqual([
    [16, 112, 212, 2, "zone-yellow"],
    [492, 112, 212, 2, "lgrey"],
    [483, 112, 2, 132, "lgrey"],
  ]);
  expect(paintedText).toHaveLength(14);
  expect(paintedText).toEqual([
    ...[layout.stage, layout.aggregate].flatMap((block) => [
      block.text,
      ...block.rows.flatMap((row) => [row.label.text, row.value.text]),
    ]),
  ]);
  expect(layout.aggregate.rows.map(({ label }) => label.text)).toEqual([
    STATS_SCOPE_TEXT.stageTotal.replace("{time}", "").trimEnd(),
    STATS_SCOPE_TEXT.zoneTotal.replace("{time}", "").trimEnd(),
    TEXT.stats.runTotal.replace("{time}", "").trimEnd(),
  ]);
  expect(data).toEqual(unchanged);
});
