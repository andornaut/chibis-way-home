import { expect, it } from "vitest";

import { CERTIFIED_LISTS } from "../data/certified/index.ts";
import { ORDINARY_PROOF_PROFILE, type Proof } from "./pairCertify.ts";
import {
  completePairProposal,
  newEntryProofProfile,
  preparePairProposal,
} from "./selectedCertification.ts";

const IDS = [
  "industrial-crane-lookout--industrial-low-roof-strip",
  "industrial-industrial-low-roof-strip--industrial-low-roof-strip",
];
const industrial = CERTIFIED_LISTS.find(({ zone }) => zone === "industrial")!;
const current = {
  ...industrial,
  entries: industrial.entries.filter(({ id }) => !IDS.includes(id)),
};
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

it("keeps a fully ordinary maintained pool ordinary for newly considered entries", () => {
  const entries = industrial.entries.filter(({ proof }) => proof !== undefined);
  expect(entries.length).toBeGreaterThan(0);
  expect(newEntryProofProfile({ entries })).toBe(ORDINARY_PROOF_PROFILE);
});

it("retains the existing default for mixed, empty and uninitialised lists", () => {
  expect(newEntryProofProfile(industrial)).toBeUndefined();
  expect(newEntryProofProfile({ entries: [] })).toBeUndefined();
  expect(newEntryProofProfile(undefined)).toBeUndefined();
});

it("rejects unknown existing profiles before selecting a new-entry default", () => {
  const entry = industrial.entries.find(({ proof }) => proof !== undefined)!;
  const invalid = { ...entry, proof: { ...ORDINARY_PROOF_PROFILE, tuning: "unknown" } };
  expect(() => newEntryProofProfile({ entries: [invalid] })).toThrow(
    "Unknown ordinary proof profile",
  );
});

it("reproves selected legacy pairs and singles without changing their facts or neighbours", () => {
  const previous = CERTIFIED_LISTS.find(({ zone }) => zone === "apartment")!;
  const ids = [
    "apartment-chandelier-approach--chandelier-swing",
    "apartment-tall-warned-vent-terrace",
  ];
  const plan = preparePairProposal("apartment", previous, ids, true);
  expect(plan.selected.map(({ candidate }) => candidate.kind)).toEqual(["pair", "single"]);
  expect(plan.selected.map(({ previous }) => previous?.id)).toEqual(ids);
  const next = completePairProposal(plan, plan.selected.map(proof));
  expect(next).toEqual({
    ...previous,
    entries: previous.entries.map((entry) =>
      ids.includes(entry.id)
        ? { ...entry, proof: ORDINARY_PROOF_PROFILE, trace: proof().trace, work: proof().work }
        : entry,
    ),
  });
});

it("rejects already ordinary, unknown and duplicate legacy selections before planning a proof", () => {
  const existing = industrial.entries.find(({ proof }) => proof !== undefined)!;
  expect(() => preparePairProposal("industrial", industrial, [existing.id], true)).toThrow(
    "Not an existing legacy entry",
  );
  expect(() => preparePairProposal("industrial", industrial, ["unknown"], true)).toThrow(
    "Not an existing legacy entry",
  );
  expect(() =>
    preparePairProposal("industrial", industrial, [existing.id, existing.id], true),
  ).toThrow("unique");
});

it("does not reprove against a stale data, layout or route preimage", () => {
  const entry = industrial.entries.find(({ proof }) => proof === undefined)!;
  const id = entry.id;
  const staleData = { ...industrial, inputs: { ...industrial.inputs, data: "stale" } };
  expect(() => preparePairProposal("industrial", staleData, [id], true)).toThrow(
    "data hash is stale",
  );
  for (const key of ["layout", "route"] as const) {
    const stale = {
      ...industrial,
      entries: industrial.entries.map((item) =>
        item.id === id ? { ...item, [key]: "stale" } : item,
      ),
    };
    expect(() => preparePairProposal("industrial", stale, [id], true)).toThrow(
      "recorded facts differ",
    );
  }
});
