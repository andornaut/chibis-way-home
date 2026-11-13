import { beforeEach, expect, it, vi } from "vitest";

const walk = vi.hoisted(() => ({
  crosses: vi.fn<(...args: unknown[]) => boolean>(() => false),
  routes: vi.fn<(...args: unknown[]) => { complete: boolean; surfaces: unknown[] }>(() => ({
    complete: true,
    surfaces: [],
  })),
}));
vi.mock("../sim/zoneWalk.ts", async (original) => ({
  ...(await original<typeof import("../sim/zoneWalk.ts")>()),
  crosses: walk.crosses,
  surfaceAt: () => ({ key: "fixture" }),
  walkRequiredRoutes: walk.routes,
}));

import { BIRD } from "../data/bird.ts";
import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import type { OrdinaryProofProfile } from "../data/types/index.ts";
import { ORDINARY } from "./encounterLayouts.ts";
import {
  GAME_CONTEXT,
  layoutOf,
  ORDINARY_PROOF_PROFILE,
  prove,
  proveForProfile,
  verifyStructure,
  zoneCandidates,
} from "./pairCertify.ts";

beforeEach(() => vi.clearAllMocks());

const selected = () => {
  const base = zoneCandidates(GAME_CONTEXT, "industrial").candidates.find(
    ({ id }) => id === "industrial-crane-lookout--industrial-low-roof-strip",
  )!;
  return {
    ...base,
    chunk: { ...base.chunk, noCross: [{ from: { col: 1, row: 80 }, to: { col: 58, row: 80 } }] },
  };
};

it("keeps omitted profiles on the legacy tuning and preserves the untagged proof shape", () => {
  const candidate = selected();
  const { themes } = layoutOf("industrial", candidate);
  const legacy = prove(candidate, themes);
  expect(proveForProfile(undefined, candidate, themes)).toEqual(legacy);
  expect(legacy).not.toHaveProperty("proof");
  expect(walk.routes.mock.calls.every(([tuning]) => tuning === BIRD)).toBe(true);
  expect(walk.crosses.mock.calls.every(([tuning]) => tuning === BIRD)).toBe(true);
  expect(walk.crosses).toHaveBeenCalled();
});

it("uses ordinary tuning for both required walks and no-cross checks and tags the result", () => {
  const candidate = selected();
  const proof = proveForProfile(
    ORDINARY_PROOF_PROFILE,
    candidate,
    layoutOf("industrial", candidate).themes,
  );
  expect(proof.problems).toEqual([]);
  expect(proof.proof).toEqual(ORDINARY_PROOF_PROFILE);
  expect(walk.routes.mock.calls.every(([tuning]) => tuning === ORDINARY)).toBe(true);
  expect(walk.crosses.mock.calls.every(([tuning]) => tuning === ORDINARY)).toBe(true);
  expect(walk.crosses).toHaveBeenCalled();
  expect(ORDINARY.doubleJump).toBe(false);
  expect(ORDINARY).not.toHaveProperty("dash");
});

it("rejects unknown profile versions and tuning fingerprints before dispatch", () => {
  const candidate = selected();
  for (const invalid of [
    { ...ORDINARY_PROOF_PROFILE, tuning: "wrong" },
    { ...ORDINARY_PROOF_PROFILE, version: 2 },
  ]) {
    expect(() => proveForProfile(invalid as OrdinaryProofProfile, candidate, [])).toThrow(
      "Unknown ordinary proof profile",
    );
  }
  expect(walk.routes).not.toHaveBeenCalled();
  const list = CERTIFIED_LISTS.find(({ zone }) => zone === "blue")!;
  const first = { ...list.entries[0]!, proof: { ...ORDINARY_PROOF_PROFILE, tuning: "wrong" } };
  expect(
    verifyStructure(GAME_CONTEXT, { ...list, entries: [first, ...list.entries.slice(1)] }),
  ).toContain(`${first.id}: Unknown ordinary proof profile, version or tuning fingerprint`);
});
