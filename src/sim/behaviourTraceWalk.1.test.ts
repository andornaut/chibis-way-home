import { vi } from "vitest";

import { registerTraceSuite, walkTraceScenarios } from "../testing/behaviourTraceSuite";

vi.mock("../rules/zone", async (original) =>
  (await import("../testing/behaviourTraceHook")).tracedZone(await original()),
);

registerTraceSuite("walk-1", walkTraceScenarios(1));
