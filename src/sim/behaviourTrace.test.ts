import { vi } from "vitest";

import {
  encounterTraceScenarios,
  registerTraceSuite,
  stageTraceScenarios,
} from "../testing/behaviourTraceSuite.ts";

vi.mock("../rules/zone.ts", async (original) =>
  (await import("../testing/behaviourTraceHook.ts")).tracedZone(await original()),
);

registerTraceSuite("encounters", encounterTraceScenarios());
registerTraceSuite("stages", stageTraceScenarios());
