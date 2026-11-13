import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const cli = fileURLToPath(new URL("./chunkPairs.ts", import.meta.url));
const certificate = fileURLToPath(new URL("../data/certified/industrial.json", import.meta.url));

it("refuses source output and selection flags on the broad certify command before any proof runs", () => {
  const before = readFileSync(certificate, "utf8");
  const rejected = spawnSync(
    process.execPath,
    [
      cli,
      "propose",
      "--zone",
      "industrial",
      "--id",
      "unknown",
      "--profile",
      "ordinary",
      "--out",
      certificate,
    ],
    { encoding: "utf8" },
  );
  expect(rejected.status).toBe(2);
  expect(rejected.stderr).toContain("within the scratch directory");
  expect(rejected.stderr).not.toContain("proved ");
  expect(readFileSync(certificate, "utf8")).toBe(before);
  const broad = spawnSync(process.execPath, [cli, "certify", "--id", "unknown"], {
    encoding: "utf8",
  });
  expect(broad.status).toBe(2);
  expect(broad.stderr).toContain("Selection flags require propose");
  expect(broad.stderr).not.toContain("to prove");
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pair-proposal-"));
  for (const name of ["src", "public", "package.json"]) {
    cpSync(resolve(name), join(root, name), { recursive: true });
  }
  symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir");
  const trap = join(root, "worker-trap.cjs");
  writeFileSync(
    trap,
    [
      "// CLEANUP (added 2026-11-13): This worker trap expires with the isolated test scratch.",
      'const workers = require("node:worker_threads");',
      'workers.Worker = class { constructor() { throw new Error("Native worker forbidden by fixture"); } };',
      'require("node:module").syncBuiltinESMExports();',
    ].join("\n"),
  );
  return {
    root,
    run: (args: readonly string[]) =>
      spawnSync(
        process.execPath,
        ["--require", trap, join(root, "src/tools/chunkPairs.ts"), ...args],
        { cwd: root, encoding: "utf8", timeout: 5000 },
      ),
  };
}

it("rejects a new checkout file even when the checkout is inside the scratch directory", () => {
  const { root, run } = fixture();
  const out = join(root, "new-proposal.json");
  const rejected = run([
    "propose",
    "--zone",
    "industrial",
    "--id",
    "unknown",
    "--profile",
    "ordinary",
    "--out",
    out,
  ]);
  expect(rejected.status).toBe(2);
  expect(rejected.stderr).toContain("outside the checkout");
  expect(rejected.stderr).not.toContain("Native worker forbidden");
  expect(existsSync(out)).toBe(false);
});

it("rejects an unknown reused profile before constructing native workers or writing certificates", () => {
  const { root, run } = fixture();
  const file = join(root, "src/data/certified/blue.json");
  const list = JSON.parse(readFileSync(file, "utf8"));
  list.entries[0].proof = null;
  const before = JSON.stringify(list);
  writeFileSync(file, before);
  const rejected = run(["certify", "--zone", "blue"]);
  expect(rejected.status).not.toBe(0);
  expect(rejected.stderr).toContain("Unknown ordinary proof profile");
  expect(rejected.stderr).not.toContain("Native worker forbidden");
  expect(readFileSync(file, "utf8")).toBe(before);
});
