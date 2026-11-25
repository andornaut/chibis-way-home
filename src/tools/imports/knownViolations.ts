// The violations the imports check still finds. Each list holds exactly the present ones of one
// rule, in alphabetical order. The check fails on a new one and on a listed one that no longer
// exists, so the table only shrinks.
// CLEANUP (added 2026-11-25): remove when the known-violations table is empty and ESLint guards
// the layers (cwh-0310).
import type { KnownViolations } from "./graph.ts";

export const KNOWN_VIOLATIONS: KnownViolations = {
  // Each import of a group in the same layer, a higher layer or no layer.
  direction: ["src/play.ts -> src/main.ts"],
  // Each importing group and the module it reaches past the entry of the module's group.
  entry: [
    "crash -> src/ui/input/actionBinding.ts",
    "loading -> src/presentation/zoneTheme.ts",
    "loading -> src/ui/chrome/modalDim.ts",
    "loading -> src/ui/input/actionBinding.ts",
  ],
  // Each group no layer places.
  unplaced: [],
};
