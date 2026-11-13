import { expect, it } from "vitest";

import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import { ORDINARY_PROOF_PROFILE, type Proof } from "./pairCertify.ts";
import { completePairProposal, preparePairProposal } from "./selectedCertification.ts";

const IDS = [
  "industrial-crane-lookout--industrial-low-roof-strip",
  "industrial-industrial-low-roof-strip--industrial-low-roof-strip",
];
const current = CERTIFIED_LISTS.find(({ zone }) => zone === "industrial")!;
const proof = (): Proof => ({
  problems: [],
  proof: ORDINARY_PROOF_PROFILE,
  trace: "0000000000000000:1",
  work: 1,
});

it("proposes only selected ordinary entries while preserving all existing entries, arenas and proof provenance", () => {
  const plan = preparePairProposal("industrial", current, IDS);
  const proposal = completePairProposal(plan, plan.selected.map(proof));
  expect(plan.selected.map(({ candidate }) => candidate.id)).toEqual([...IDS].sort());
  expect(proposal.entries.filter(({ id }) => !IDS.includes(id))).toEqual(current.entries);
  expect(proposal.arenas).toBe(current.arenas);
  expect(proposal.inputs.proofs).toBe(current.inputs.proofs);
  expect(
    proposal.entries
      .filter(({ id }) => IDS.includes(id))
      .every(({ proof }) => proof === ORDINARY_PROOF_PROFILE),
  ).toBe(true);
  expect(current.entries.some(({ id }) => IDS.includes(id))).toBe(false);
});

it("refuses duplicate, unknown and existing IDs without changing the certificate", () => {
  expect(() => preparePairProposal("industrial", current, [IDS[0]!, IDS[0]!])).toThrow("unique");
  expect(() => preparePairProposal("industrial", current, ["unknown"])).toThrow(
    "Not a new selected pair",
  );
  expect(() => preparePairProposal("industrial", current, [current.entries[0]!.id])).toThrow(
    "Not a new selected pair",
  );
});

it("refuses incomplete, legacy, mismatched-count and failed native proofs", () => {
  const plan = preparePairProposal("industrial", current, IDS);
  expect(() => completePairProposal(plan, [])).toThrow("one proof");
  for (const invalid of [
    { ...proof(), proof: undefined },
    { ...proof(), work: 2 },
    { ...proof(), problems: ["required routes incomplete"] },
  ]) {
    expect(() => completePairProposal(plan, [{ ...invalid } as Proof, proof()])).toThrow(
      "incomplete or invalid",
    );
  }
});
