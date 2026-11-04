import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { SPEAKERS } from "../data/dialogues";
import { ZONE_MAP } from "../data/map";
import { STATS_BARKS } from "../data/statsBarks";
import { TEXT } from "../data/text";
import { dialogueParagraphs } from "../ui";
vi.mock("./dialogueParagraph", () => ({ drawDialogueParagraph: vi.fn() }));
import { drawDialogueParagraph } from "./dialogueParagraph";
import { drawStatsStatement } from "./statsStatement";

it.each(["clear", "retry"] as const)("maps the actual stage to its one %s statement", (kind) => {
  const image = { setOrigin: vi.fn() };
  const scene = { add: { image: vi.fn(() => image) } } as unknown as Scene;
  for (const zone of ZONE_MAP.destinations) {
    drawStatsStatement(scene, kind, zone.stages.at(-1)!);
    expect(vi.mocked(drawDialogueParagraph).mock.lastCall).toEqual([
      scene,
      dialogueParagraphs(SPEAKERS, TEXT, {
        lines: [STATS_BARKS[zone.id as keyof typeof STATS_BARKS][kind]],
      })[0],
    ]);
  }
});
it("omits a fabricated speaker for an uncatalogued diagnostic stage", () => {
  const scene = { add: { image: vi.fn() } } as unknown as Scene;
  drawStatsStatement(scene, "retry", "diagnostic-stage");
  expect(scene.add.image).not.toHaveBeenCalled();
});
