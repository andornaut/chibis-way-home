import { vi } from "vitest";

import {
  encounterTraceScenarios,
  registerTraceSuite,
  stageTraceScenarios,
} from "../testing/behaviourTraceSuite";

vi.mock("../rules/zone", async (original) =>
  (await import("../testing/behaviourTraceHook")).tracedZone(await original()),
);

registerTraceSuite("encounters", encounterTraceScenarios());
registerTraceSuite("stages", stageTraceScenarios());
