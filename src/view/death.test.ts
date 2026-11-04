import { describe, expect, it } from "vitest";

import { STEP_SECONDS } from "../core";
import { BIRD } from "../data/bird";
import { DEATH } from "../data/death";
import { ZONE_MAP } from "../data/map";
import { SCREEN } from "../data/screen";
import { TEXT } from "../data/text";
import type { Rect, ZoneDeath } from "../data/types";
import { BIRD_FRAME } from "./bird";
import {
  deathLabels,
  deathPresentationTarget,
  deathSummary,
  type DeathView,
  startDeathPresentation,
  stepDeathPresentation,
} from "./death";

const ground: Rect = { height: 120, width: SCREEN.width, x: 0, y: (SCREEN.height * 2) / 3 };
const view: DeathView = {
  body: BIRD,
  bounds: { ...SCREEN, x: 0, y: ground.y - SCREEN.height + DEATH.cameraPan.bottomInset },
  frame: BIRD_FRAME,
};
const death: ZoneDeath = {
  position: { x: 100, y: ground.y - BIRD.height },
  reason: "hazard",
  support: ground,
  velocity: { x: BIRD.walkSpeed, y: 0 },
};

describe("death presentation", () => {
  it.each([-1, 1] as const)(
    "recoils against facing %i, falls, squashes, bounces upward and seats",
    (facing) => {
      let pose = startDeathPresentation(DEATH, view, facing, death);
      const phases = new Set([pose.phase]);
      const x = pose.position.x;
      let bounceRose = false;
      for (let step = 0; step < 1200 && pose.phase !== "seated"; step++) {
        const before = pose;
        pose = stepDeathPresentation(DEATH, view, STEP_SECONDS, pose);
        phases.add(pose.phase);
        if (before.phase === "bounce" && pose.position.y < before.position.y) {
          bounceRose = true;
        }
      }
      expect(phases).toEqual(new Set(["recoil", "fall", "impact", "bounce", "seated"]));
      expect(Math.sign(pose.position.x - x)).toBe(Math.sign(DEATH.recoilVelocity.x * facing));
      expect(bounceRose).toBe(true);
      expect(pose.position.y + BIRD.height).toBe(ground.y);
      expect(view.bounds.y + view.bounds.height - pose.position.y - BIRD.height).toBe(
        DEATH.cameraPan.bottomInset,
      );
      expect(stepDeathPresentation(DEATH, view, 100, pose)).toBe(pose);
    },
  );

  it("keeps a void fall and seated rest visible in the frozen viewport", () => {
    let pose = startDeathPresentation(DEATH, view, 1, {
      ...death,
      position: { ...death.position, y: SCREEN.height * 2 },
      reason: "fall",
      support: undefined,
    });
    expect(pose.phase).toBe("fall");
    expect(pose.floor - pose.position.y - BIRD.height).toBe(DEATH.voidFallDistance);
    expect(pose.position.y + BIRD.height).toBeLessThan(ground.y);
    for (let step = 0; step < 1200 && pose.phase !== "seated"; step++) {
      pose = stepDeathPresentation(DEATH, view, STEP_SECONDS, pose);
    }
    expect(pose.phase).toBe("seated");
    expect(pose.position.y + BIRD.height).toBe(ground.y);
  });

  it("resolves frozen support at the final recoil position before the camera or animation starts", () => {
    const queried: { x: number; y: number }[] = [];
    const target = deathPresentationTarget(
      DEATH,
      BIRD,
      (position) => {
        queried.push(position);
        return ground;
      },
      1,
      death,
    );
    expect(queried).toEqual([
      {
        x: death.position.x + DEATH.recoilVelocity.x * DEATH.recoilSeconds,
        y: death.position.y + DEATH.recoilVelocity.y * DEATH.recoilSeconds,
      },
    ]);
    expect(target).toEqual({ x: queried[0]!.x, y: ground.y - BIRD.height });
  });
});

describe("death summary", () => {
  it.each([
    { activeSeconds: 65.8, percent: 0.25, progress: "25", time: "1:05" },
    { activeSeconds: 0, percent: 0, progress: "0", time: "0:00" },
  ])(
    "formats active time and current-attempt progress without advancing either",
    ({ activeSeconds, percent, progress, time }) => {
      const result = deathSummary(TEXT.death, {
        activeSeconds,
        ...deathLabels(ZONE_MAP, TEXT.map, "1", ZONE_MAP.start),
        percent,
      });
      expect(result.time).toBe(TEXT.death.time.replace("{time}", time));
      expect(result.progress).toBe(TEXT.death.progress.replace("{percent}", progress));
      const destination = ZONE_MAP.destinations.find(({ stages }) =>
        stages.includes(ZONE_MAP.start),
      );
      expect(result.title).toBe(
        TEXT.death.title.replace("{zone}", TEXT.map.zones[destination?.id ?? ""] ?? "1"),
      );
      expect(result.stage).toBe(
        TEXT.death.stage
          .replace("{number}", "1")
          .replace("{name}", TEXT.map.stages[ZONE_MAP.start] ?? "1"),
      );
    },
  );
  it("uses numeric debug labels outside the stage catalogue", () => {
    expect(deathLabels(ZONE_MAP, TEXT.map, "3", "test:3")).toEqual({
      stageLabel: "3",
      stageNumber: "3",
      zoneLabel: "3",
    });
  });
});

it.each(
  ZONE_MAP.destinations.flatMap(({ stages }) =>
    stages.map((id, index) => ({ id, number: String(index + 1) })),
  ),
)("derives $id stage number from its destination order", ({ id, number }) => {
  const labels = deathLabels(ZONE_MAP, TEXT.map, "debug", id);
  expect(labels.stageNumber).toBe(number);
  const summary = deathSummary(TEXT.death, { ...labels, activeSeconds: 0, percent: 0 });
  expect(summary.stage).toBe(
    TEXT.death.stage.replace("{number}", number).replace("{name}", TEXT.map.stages[id]!),
  );
});
