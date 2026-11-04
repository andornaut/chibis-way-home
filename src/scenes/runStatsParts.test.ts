import { parseBitmapFont } from "@andornaut/game-kit/text/bitmapFont";
import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import fontBody from "../../public/art/fonts/font-body.fnt?raw";
import fontTitle from "../../public/art/fonts/font-title.fnt?raw";
import { ZONE_MAP } from "../data/map";
import { STAGE_PREVIEWS } from "../data/stagePreviews";
import { TEXT } from "../data/text";
import type { Point } from "../data/types";
import { STAGE_SUMMARY_BOUNDS, statsStatement, textInkBounds } from "../ui";

vi.mock("./cardParts", () => ({
  BODY_FONT: "font-body",
  TITLE_FONT: "font-title",
  addCardText: (_scene: unknown, font: string, point: Point, text: string) => {
    const record = { font, lineSpacing: 0, point, scale: 1, text };
    painted.push(record);
    const object = {
      setLeftAlign: () => ({ setLineSpacing: vi.fn() }),
      setLineSpacing: (lineSpacing: number) => {
        record.lineSpacing = lineSpacing;
        return object;
      },
      setScale: (scale: number) => {
        record.scale = scale;
        return object;
      },
    };
    return object;
  },
  cardFonts: () => ({ body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) }),
  paletteColour: (_scene: unknown, colour: string) => colour,
}));

import { addStageSummary } from "./runStatsParts";

const painted: { font: string; point: Point; text: string; scale: number; lineSpacing: number }[] =
  [];

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
  expect(image).toHaveBeenCalledExactlyOnceWith(
    layout.image.x,
    layout.image.y,
    STAGE_PREVIEWS[stage],
  );
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
  expect(painted[0]).toMatchObject({
    font: "font-title",
    lineSpacing: 20 / (17 / 16) - 20,
    scale: 17 / 16,
  });
  expect(painted.slice(1).every(({ scale }) => scale === 1)).toBe(true);
  expect(painted[1]!.font).toBe("font-body");
  expect(layout.totals.map(({ value }) => value.text)).toEqual(["1:15", "2:10", "2057:36"]);
  const fonts = { body: parseBitmapFont(fontBody), title: parseBitmapFont(fontTitle) };
  const tops = painted.map(({ font, point, scale, text }) => {
    const ink = textInkBounds(
      font === "font-title" ? fonts.title : fonts.body,
      scale,
      fonts.body.lineHeight * scale,
      text,
    );
    return { x: point.x + ink.x, y: point.y + ink.y };
  });
  expect(tops.slice(0, 3).map(({ y }) => y)).toEqual([
    layout.zone.rect.y,
    layout.stage.rect.y,
    layout.progress.rect.y,
  ]);
  expect(tops.slice(3, 9).map(({ y }) => y)).toEqual(
    layout.stats.flatMap(({ label, value }) => [label.rect.y, value.rect.y]),
  );
  expect(tops.slice(-2).map(({ y }) => y)).toEqual([
    layout.statement!.name.rect.y,
    layout.statement!.text.rect.y,
  ]);
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
