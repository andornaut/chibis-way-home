import { describe, expect, it } from "vitest";

import type { Rect } from "../data/types";
import { crumblingSupportPresent, initialCrumblingWorld } from "./crumbling";
import {
  beginCrumblingFrame,
  type CrumblingFrameRequest,
  endCrumblingFrame,
} from "./crumblingFrame";

const support: Rect = { height: 30, width: 60, x: 0, y: 100 };
const unmarked: Rect = { height: 30, width: 60, x: 100, y: 100 };
const definitions = [
  { profile: { absentSeconds: 2, warningSeconds: 0.8 }, supportId: support, volume: support },
];
const body: Rect = { height: 20, width: 10, x: 10, y: 80 };
const frame = (timeSeconds: number): CrumblingFrameRequest<string> => ({
  actorIds: ["chibi", "boss"],
  actors: [
    { actorId: "chibi", body, standingSupportIds: [] },
    { actorId: "boss", body: { ...body, x: 30 }, standingSupportIds: [] },
  ],
  timeSeconds,
});

describe("authoritative crumbling frame", () => {
  it("commits one shared begin before colliders and all actor contacts after physics for the next boundary", () => {
    const initial = initialCrumblingWorld<string>(definitions);
    const begun = beginCrumblingFrame(definitions, frame(0), initial);
    expect(beginCrumblingFrame(definitions, frame(0), begun)).toBe(begun);
    expect(crumblingSupportPresent(begun, support)).toBe(true);
    const actual = frame(0.1);
    const ended = endCrumblingFrame(
      definitions,
      {
        ...actual,
        actors: actual.actors.map((actor) => ({ ...actor, standingSupportIds: [support] })),
      },
      begun,
    );
    expect(ended.pendingContacts).toEqual([
      { actorId: "chibi", supportId: support },
      { actorId: "boss", supportId: support },
    ]);
    expect(ended.supports[0]!.phase.kind).toBe("intact");
    const warning = beginCrumblingFrame(definitions, frame(0.1), ended);
    expect(warning.supports[0]!.phase).toEqual({ kind: "warning", removeAtSeconds: 0.9 });
    const expired = beginCrumblingFrame(definitions, frame(0.9), warning);
    expect(crumblingSupportPresent(expired, support)).toBe(false);
    expect(crumblingSupportPresent(expired, unmarked)).toBe(true);
    expect(expired.supports[0]!.phase).toEqual({ kind: "absent", restoreAfterSeconds: 2.9 });
    expect(initial.supports[0]!.phase.kind).toBe("intact");
  });

  it("keeps restoration blocked by any actual actor and ignores overlap without a resolved support contact", () => {
    const initial = initialCrumblingWorld<string>(definitions);
    const absent = {
      ...initial,
      supports: [
        { phase: { kind: "absent" as const, restoreAfterSeconds: 2 }, supportId: support },
      ],
    };
    const overlap = frame(2);
    const occupied = beginCrumblingFrame(
      definitions,
      {
        ...overlap,
        actors: overlap.actors.map((actor) =>
          actor.actorId === "boss" ? { ...actor, body: { ...body, y: 120 } } : actor,
        ),
      },
      absent,
    );
    expect(occupied.supports[0]!.phase.kind).toBe("absent");
    const restored = beginCrumblingFrame(definitions, frame(2.1), occupied);
    expect(restored.supports[0]!.phase.kind).toBe("intact");
    const noLanding = endCrumblingFrame(definitions, frame(2.2), restored);
    expect(noLanding.pendingContacts).toEqual([]);
    expect(beginCrumblingFrame(definitions, frame(2.2), noLanding).supports[0]!.phase.kind).toBe(
      "intact",
    );
  });

  it.each(["missing", "duplicate", "unexpected"] as const)(
    "rejects %s actual actors instead of assuming an empty future",
    (kind) => {
      const request = frame(0);
      const actors =
        kind === "missing"
          ? request.actors.slice(0, 1)
          : kind === "duplicate"
            ? [request.actors[0]!, request.actors[0]!]
            : [request.actors[0]!, { ...request.actors[1]!, actorId: "decorative" }];
      const invalid = { ...request, actors };
      const initial = initialCrumblingWorld<string>(definitions);
      expect(() => beginCrumblingFrame(definitions, invalid, initial)).toThrow(/actor/);
      expect(() => endCrumblingFrame(definitions, invalid, initial)).toThrow(/actor/);
    },
  );
});
