import { expect, it } from "vitest";

import { STATS_SCOPE_TEXT, TEXT } from "../../data/text.ts";
import { statsTotalRows } from "./runStats.ts";

it("formats each total from its own read-only active-time snapshot", () => {
  const totals = { runSeconds: 610.8, stageSeconds: 130.9, zoneSeconds: 290.2 };
  expect(statsTotalRows({ ...STATS_SCOPE_TEXT, runTotal: TEXT.stats.runTotal }, totals)).toEqual([
    { label: STATS_SCOPE_TEXT.stageTotal.replace("{time}", "").trimEnd(), value: "2:10" },
    { label: STATS_SCOPE_TEXT.zoneTotal.replace("{time}", "").trimEnd(), value: "4:50" },
    { label: TEXT.stats.runTotal.replace("{time}", "").trimEnd(), value: "10:10" },
  ]);
  expect(totals).toEqual({ runSeconds: 610.8, stageSeconds: 130.9, zoneSeconds: 290.2 });
});
