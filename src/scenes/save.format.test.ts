import { afterEach, expect, it, vi } from "vitest";

import { ZONE_MAP } from "../data/map.ts";
import type { ZoneState } from "../rules/zone.ts";

// Storage writes recorded from the previous save code: the scripted session below from empty
// storage, then a reopen of its final records. The current code must write the same keys and
// bytes, so saved games keep loading without a version change.
const SESSION_WRITES: readonly (readonly [string, string])[] = [
  [
    "chibis-way-home.save",
    ['{"activeSkill":null,"at":"beginning","openingSeen":true,"skills":[],"version":11', "}"].join(
      "",
    ),
  ],
  [
    "chibis-way-home.save",
    [
      '{"activeSkill":null,"at":"map","completed":[],"openingSeen":true,"seenZoneIntros',
      '":[],"skills":[],"stand":"street","version":11}',
    ].join(""),
  ],
  [
    "chibis-way-home.save",
    [
      '{"activeSkill":"dash","at":"map","completed":[],"openingSeen":true,"seenZoneIntr',
      'os":[],"skills":["dash"],"stand":"street","version":11}',
    ].join(""),
  ],
  [
    "chibis-way-home.save",
    [
      '{"activeSkill":"dash","at":"map","completed":[],"openingSeen":true,"seenZoneIntr',
      'os":[],"skills":["dash","speedy"],"stand":"street","version":11}',
    ].join(""),
  ],
  [
    "chibis-way-home.save",
    [
      '{"activeSkill":"speedy","at":"map","completed":[],"openingSeen":true,"seenZoneIn',
      'tros":[],"skills":["dash","speedy"],"stand":"street","version":11}',
    ].join(""),
  ],
  [
    "chibis-way-home.save",
    [
      '{"activeSkill":"speedy","at":"map","completed":[],"stand":"street","openingSeen"',
      ':true,"seenZoneIntros":["blue-cityscape"],"skills":["dash","speedy"],"version":1',
      "1}",
    ].join(""),
  ],
  [
    "chibis-way-home.stats",
    [
      '{"stages":{"street":{"run":{"attemptSeconds":1.5,"attempts":2,"completed":true,"',
      'runSeconds":2.25},"bestSeconds":1.5}},"totals":{"stages":{"street":2.25},"zones"',
      ':{"blue-cityscape":2.25}},"wholeRun":{"activeSeconds":2.25,"deaths":1,"skillUsed',
      '":true},"zones":{},"visit":{"stages":{"street":{"attemptSeconds":1.5,"attempts":',
      '2,"completed":true,"runSeconds":2.25}},"zone":"blue-cityscape"},"version":7}',
    ].join(""),
  ],
  [
    "chibis-way-home.save",
    [
      '{"activeSkill":"speedy","at":"map","completed":["street"],"openingSeen":true,"se',
      'enZoneIntros":["blue-cityscape"],"skills":["dash","speedy"],"stand":"street","ve',
      'rsion":11}',
    ].join(""),
  ],
  [
    "chibis-way-home.save",
    [
      '{"activeSkill":"speedy","at":"map","completed":["street"],"openingSeen":true,"se',
      'enZoneIntros":["blue-cityscape"],"skills":["dash","speedy"],"stand":"city-street',
      's","version":11}',
    ].join(""),
  ],
];
const REOPEN_WRITES: readonly (readonly [string, string])[] = [
  [
    "chibis-way-home.save",
    [
      '{"activeSkill":"speedy","at":"map","completed":["street"],"openingSeen":true,"se',
      'enZoneIntros":["blue-cityscape"],"skills":["dash","speedy"],"stand":"city-street',
      's","version":11}',
    ].join(""),
  ],
  [
    "chibis-way-home.stats",
    [
      '{"stages":{"street":{"bestSeconds":1.5,"run":{"attemptSeconds":2,"attempts":2,"c',
      'ompleted":true,"runSeconds":2.75}}},"totals":{"stages":{"street":2.75},"zones":{',
      '"blue-cityscape":2.75}},"wholeRun":{"activeSeconds":2.75,"deaths":1,"skillUsed":',
      'true},"zones":{},"visit":{"stages":{"street":{"attemptSeconds":2,"attempts":2,"c',
      'ompleted":true,"runSeconds":2.75}},"zone":"blue-cityscape"},"version":7}',
    ].join(""),
  ],
];

const STILL = {
  cleared: false,
  death: undefined,
  door: undefined,
  steps: 0,
  turnedBack: false,
} as ZoneState;
const MOVING = { ...STILL, steps: 1 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function storage(initial: readonly (readonly [string, string])[]): [string, string][] {
  const values = new Map<string, string>(initial);
  const writes: [string, string][] = [];
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push([key, value]);
      values.set(key, value);
    },
  });
  return writes;
}

it("writes the same records under the same keys as before the move", async () => {
  const writes = storage([]);
  const save = await import("./save.ts");
  await save.loadProgress();
  const destination = ZONE_MAP.destinations[0]!;
  const [first, second] = destination.stages;
  const dead = {
    ...MOVING,
    death: {
      position: { x: 0, y: 0 },
      reason: "fall",
      support: undefined,
      velocity: { x: 0, y: 0 },
    },
    steps: 2,
  } as ZoneState;
  expect([first, second]).toEqual(["street", "city-streets"]);
  save.saveOpeningSeen();
  save.beginZoneVisit(destination.id);
  save.beginStageRun(first!);
  save.recordActiveStageStep(first!, 0.5, STILL, MOVING);
  save.recordActiveStageStep(first!, 0.25, MOVING, dead);
  save.retryStageRun(first!);
  save.grantSkill("dash");
  save.grantSkill("speedy");
  save.selectActiveSkill("speedy");
  save.saveZoneIntro(destination.id);
  save.recordActiveStageStep(first!, 1.5, STILL, MOVING);
  save.completeStageRun(first!);
  save.saveCompleted(first!);
  save.saveStand(second!);
  await save.flushStats();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(writes).toEqual(SESSION_WRITES);
});

it("reopens records saved before the move and writes them back byte for byte", async () => {
  const finals = [...new Map(SESSION_WRITES.map(([key, value]) => [key, value]))];
  const writes = storage(finals);
  const save = await import("./save.ts");
  await save.loadProgress();
  expect(save.savedProgress()).toEqual({
    activeSkill: "speedy",
    at: "map",
    completed: ["street"],
    openingSeen: true,
    seenZoneIntros: ["blue-cityscape"],
    skills: ["dash", "speedy"],
    stand: "city-streets",
  });
  expect(save.activeSkill()).toBe("speedy");
  expect(save.stageRunStats("street")).toEqual({
    attemptSeconds: 1.5,
    attempts: 2,
    bestSeconds: 1.5,
    cumulativeSeconds: 2.25,
    runSeconds: 2.25,
  });
  save.saveStand(save.savedMap().stand);
  save.recordActiveStageStep("street", 0.5, STILL, MOVING);
  await save.flushStats();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(writes).toEqual(REOPEN_WRITES);
  expect(writes[0]).toEqual(finals.find(([key]) => key === "chibis-way-home.save"));
});
