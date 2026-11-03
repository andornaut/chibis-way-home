import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { STAGE_PREVIEWS } from "../data/stagePreviews";
import { TEXT } from "../data/text";
import type { Point } from "../data/types";
import { STAGE_SUMMARY_BOUNDS } from "../layout/cutscene";
import { textInkBounds } from "../layout/textInk";
import { statsStatement } from "../view/statsStatement";

vi.mock("./cardParts", () => ({
  BODY_FONT: "font-body",
  TITLE_FONT: "font-title",
  addCardText: (_scene: unknown, font: string, point: Point, text: string) => {
    painted.push({ font, point, text });
    return { setLeftAlign: () => ({ setLineSpacing: vi.fn() }) };
  },
  cardFonts: () => ({ body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) }),
  paletteColour: (_scene: unknown, colour: string) => colour,
}));

import { addStageSummary } from "./runStatsParts";

const painted: { font: string; point: Point; text: string }[] = [];

it("paints the preview-first page and its single unboxed statement without panels or dividers", () => {
  painted.length = 0;
  const stage = ZONE_MAP.destinations.find((zone) => zone.id === "industrial")!.stages[1]!;
  const rectangle = vi.fn();
  const size = vi.fn();
  const image = vi.fn(() => ({ setOrigin: () => ({ setDisplaySize: size }) }));
  const scene = { add: { image, rectangle }, textures: { exists: () => true } } as unknown as Scene;
  const runStats = {
    attemptSeconds: 30,
    attempts: 2,
    bestSeconds: 20,
    cumulativeSeconds: 75,
    runSeconds: 50,
  };
  const data = {
    percent: 1,
    runStats,
    stage,
    statement: statsStatement("clear", stage),
    wholeRun: { activeSeconds: 123456, completed: 19, deaths: 9876, total: 21 },
    zoneStats: { ...runStats, completed: 1, cumulativeSeconds: 130, partial: true, total: 3 },
  };
  const unchanged = structuredClone(data);
  const layout = addStageSummary(scene, STAGE_SUMMARY_BOUNDS, data);
  expect(image).toHaveBeenCalledExactlyOnceWith(240, 72, STAGE_PREVIEWS[stage]);
  expect(size).toHaveBeenCalledExactlyOnceWith(240, 120);
  expect(rectangle).not.toHaveBeenCalled();
  expect(painted.map(({ text }) => text)).toEqual([
    layout.zone.text,
    layout.stage.text,
    layout.progress.text,
    ...[...layout.stats, ...layout.totals].flatMap((row) => [row.label.text, row.value.text]),
    layout.statement!.name.text,
    layout.statement!.text.text,
  ]);
  expect(painted).toHaveLength(17);
  expect(layout.totals.map(({ value }) => value.text)).toEqual(["1:15", "2:10", "2057:36"]);
  const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
  const tops = painted.map(({ font, point, text }) => {
    const ink = textInkBounds(font === "font-title" ? fonts.title : fonts.body, 2, 16, text);
    return { x: point.x + ink.x, y: point.y + ink.y };
  });
  expect(tops.slice(0, 3).map(({ y }) => y)).toEqual([16, 34, 52]);
  expect(tops.slice(3, 9).map(({ y }) => y)).toEqual([200, 200, 220, 220, 240, 240]);
  expect(tops.slice(-2).map(({ y }) => y)).toEqual([260, 260]);
  expect(data).toEqual(unchanged);
  painted.length = 0;
  const returned = addStageSummary(scene, STAGE_SUMMARY_BOUNDS, {
    ...data,
    percent: 0.37,
    statement: undefined,
  });
  expect(returned.statement).toBeUndefined();
  expect(painted.some(({ text }) => text === TEXT.death.progress.replace("{percent}", "37"))).toBe(
    true,
  );
});
