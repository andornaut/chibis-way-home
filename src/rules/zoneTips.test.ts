import { describe, expect, it } from "vitest";

import { BOSS_CHARACTERS } from "../data/achievements.ts";
import { ROOMS } from "../data/rooms.ts";
import type { AreaLayout, ObjectLayout } from "../data/types/index.ts";
import type { BehaviourState } from "./behaviour.ts";
import type { ZoneState } from "./zone.ts";
import { stepTips, tipsInView } from "./zoneTips.ts";

const VIEW = { height: 360, width: 720, x: 1000, y: 0 };

const object = (fields: Partial<ObjectLayout>): ObjectLayout =>
  ({
    character: "prop",
    height: 32,
    origin: { x: 0, y: 200 },
    room: undefined,
    width: 32,
    ...fields,
  }) as ObjectLayout;

const area = (objects: readonly ObjectLayout[]) => ({ objects }) as unknown as AreaLayout;

describe("tipsInView", () => {
  it("offers doors and red hazards only while they overlap the view, where they are now", () => {
    const door = object({ room: Object.keys(ROOMS)[0]! });
    const hazard = object({ contactCue: "red-hazard" });
    const timed = object({
      contactCue: "red-hazard",
      phaseTiles: {} as NonNullable<ObjectLayout["phaseTiles"]>,
    });
    const layout = area([door, hazard, timed]);
    const off = { x: 0, y: 200 };
    const on = { x: 1200, y: 200 };
    expect(tipsInView(layout, { objects: [off, off, on] }, VIEW)).toEqual([]);
    expect(tipsInView(layout, { objects: [on, off, on] }, VIEW)).toEqual(["doors"]);
    expect(tipsInView(layout, { objects: [off, on, on] }, VIEW)).toEqual(["hazards"]);
  });
});

describe("stepTips", () => {
  const boss = object({ character: BOSS_CHARACTERS.archie });
  const engaged = (engagements: number) =>
    ({
      pursuit: { engagements, phase: "engaged", settled: false, unreachableSeconds: 0 },
    }) as BehaviourState;
  const zone = (behaviour: BehaviourState | undefined, fields: Partial<ZoneState> = {}) =>
    ({ area: "main", behaviours: [behaviour], death: undefined, ...fields }) as ZoneState;

  it("offers bosses when a boss acquires Chibi, not while one stays engaged", () => {
    expect(stepTips(area([boss]), zone(undefined), zone(engaged(1)))).toEqual(["bosses"]);
    expect(stepTips(area([boss]), zone(engaged(1)), zone(engaged(1)))).toEqual([]);
    expect(stepTips(area([boss]), zone(engaged(1)), zone(engaged(2)))).toEqual(["bosses"]);
    expect(stepTips(area([object({})]), zone(undefined), zone(engaged(1)))).toEqual([]);
    expect(
      stepTips(
        area([boss]),
        zone(undefined),
        zone(engaged(1), { death: {} as ZoneState["death"] }),
      ),
    ).toEqual([]);
  });
});
