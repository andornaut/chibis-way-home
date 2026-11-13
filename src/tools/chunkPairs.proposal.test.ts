import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
