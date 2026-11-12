import { vi } from "vitest";

import { registerTraceSuite, walkTraceScenarios } from "../testing/behaviourTraceSuite.ts";

vi.mock("../rules/zone.ts", async (original) =>
  (await import("../testing/behaviourTraceHook.ts")).tracedZone(await original()),
);

registerTraceSuite("walk-0", walkTraceScenarios(0));
