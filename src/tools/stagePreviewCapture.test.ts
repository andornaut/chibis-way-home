import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Script } from "node:vm";

import { encodeRgbaPng } from "@andornaut/art-kit/build/png";
import { expect, it } from "vitest";

import { SCREEN } from "../data/screen.ts";
import { STAGE_PREVIEWS } from "../data/stagePreviews.ts";
import {
  buildReceipt,
  type CaptureObservation,
  checkoutSource,
  observePreviewCapture,
  prepareCapture,
  startPreviewScroll,
  verifyCapture,
} from "./stagePreviewCapture.ts";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const source = "a".repeat(40);
const dist = [
  { bytes: 1, path: "dist/assets/main.js", sha256: hash("s") },
  { bytes: 1, path: "dist/play/index.html", sha256: hash("h") },
];
const context = {
  build: {
    artifact: { treeSha256: hash(JSON.stringify(dist, ["path", "bytes", "sha256"])) },
    source,
  },
  buildReceiptSha256: hash("build owner receipt"),
  camera: "explicit" as const,
  dist,
  origin: "http://127.0.0.1:4173",
  source,
  sourceCheck: "git" as const,
};
const search = "?stagePreview=street&assembly=0&seed=42&previewX=1800&previewY=500";
function fixture(request = prepareCapture(context, search)) {
  const observation: CaptureObservation = {
    canvas: { cssHeight: 360, cssWidth: 720, dpr: 2, height: 720, width: 1440 },
    metadata: {
      area: "main",
      areaSize: { height: 720, width: 2000 },
      assemblySeed: 0,
      camera: { height: 720, width: 1440, x: 0, y: 0, zoom: 2 },
      inputEnabled: false,
      motionSeed: 42,
      scroll: { x: 1280, y: 360 },
      stage: "street",
      startScroll: { x: 0, y: 420 },
      steps: 0,
    },
    observedAt: "2026-11-15T00:00:00.000Z",
    ready: true,
    resources: dist.map((file) => ({
      sha256: file.sha256,
      url: new URL(
        file.path === "dist/play/index.html" ? request.url : file.path.slice(4),
        context.origin,
      ).href,
    })),
    stage: "street",
    url: request.url,
  };
  const png = encodeRgbaPng(
    { deflateLevel: 9, deflateStrategy: 0, filterType: -1 },
    {
      data: new Uint8Array(SCREEN.width * SCREEN.height * 4).fill(255),
      height: SCREEN.height,
      width: SCREEN.width,
    },
  );
  return { observation, png, request };
}
it("prepares only one explicit existing image key and rejects incomplete or unbound build input", () => {
  const request = prepareCapture(context, search);
  expect(request.status).toBe("prepared");
  expect(request.imageKey).toBe(STAGE_PREVIEWS.street);
  expect(request.preview.scroll).toEqual({ x: 1800, y: 500 });
  expect(request).not.toHaveProperty("raw");
  expect(() => prepareCapture(context, search.replace("&seed=42", ""))).toThrow();
  expect(() => prepareCapture({ ...context, source: "b".repeat(40) }, search)).toThrow();
  expect(() => prepareCapture({ ...context, dist: dist.slice(1) }, search)).toThrow();
  expect(prepareCapture({ ...context, origin: "http://chibi-preview:4173" }, search).url).toMatch(
    /^http:\/\/chibi-preview:4173\/play\/\?/,
  );
  expect(() => prepareCapture({ ...context, origin: "http://example.com:4173" }, search)).toThrow(
    "origin",
  );
});
it("writes the owner build receipt that prepare binds to", () => {
  expect(buildReceipt(source, dist)).toEqual({
    artifact: { files: 2, path: "dist", treeSha256: context.build.artifact.treeSha256 },
    source,
  });
  expect(() => buildReceipt("abc", dist)).toThrow();
});
it("accepts a named source only with a clean-tree attestation the check container agrees with", () => {
  const at = (env: NodeJS.ProcessEnv) => ({ env, root: "/nonexistent" });
  expect(checkoutSource(at({}), { cleanTree: true, source })).toEqual({
    source,
    sourceCheck: "caller",
  });
  expect(
    checkoutSource(at({ CHECK_REVISION: source, CHECK_SOURCE_DIRTY: "false" }), {
      cleanTree: true,
      source,
    }).sourceCheck,
  ).toBe("caller");
  expect(() => checkoutSource(at({}), { source })).toThrow("--clean-tree");
  expect(() =>
    checkoutSource(at({ CHECK_REVISION: "b".repeat(40) }), { cleanTree: true, source }),
  ).toThrow("revision");
  expect(() =>
    checkoutSource(at({ CHECK_SOURCE_DIRTY: "true" }), { cleanTree: true, source }),
  ).toThrow("revision");
});
it("computes the game's start scroll for a stage: street starts with his feet on its first ground", () => {
  expect(startPreviewScroll({ assemblySeed: 0, key: "street", motionSeed: 1 })).toEqual({
    x: 0,
    y: 420,
  });
});
it("requires the page's own start scroll to equal the prepared one in start mode", () => {
  const start = prepareCapture(
    { ...context, camera: "start" },
    search.replace("previewX=1800&previewY=500", "previewX=1280&previewY=360"),
  );
  expect(start.camera).toBe("start");
  const { observation, png } = fixture(start);
  expect(() => verifyCapture(start, observation, png)).toThrow("start camera");
  const matched = {
    ...observation,
    metadata: { ...observation.metadata!, startScroll: { x: 1280, y: 360 } },
  };
  expect(verifyCapture(start, matched, png).camera).toEqual({
    mode: "start",
    scroll: { x: 1280, y: 360 },
  });
});
it("verifies the unchanged raw frame with actual clamped camera, served bytes and DPR geometry", () => {
  const { observation, png, request } = fixture();
  const result = verifyCapture(request, observation, png);
  expect(result.status).toBe("verified-observed-frame");
  expect(result.camera).toEqual({ mode: "explicit", scroll: { x: 1280, y: 360 } });
  expect(result.observation.metadata?.scroll).toEqual({ x: 1280, y: 360 });
  expect(result.raw).toMatchObject({
    height: 360,
    sha256: createHash("sha256").update(png).digest("hex"),
    width: 720,
  });
  expect(result.art).toMatchObject({
    imageKey: STAGE_PREVIEWS.street,
    size: { height: 84, width: 168 },
  });
});
it("refuses request-derived camera, missing readiness, changed served build or letterboxed frames", () => {
  const { observation, png, request } = fixture();
  expect(() => verifyCapture(request, { ...observation, ready: false }, png)).toThrow();
  expect(() => verifyCapture(request, { ...observation, metadata: undefined }, png)).toThrow();
  expect(() =>
    verifyCapture(
      request,
      { ...observation, metadata: { ...observation.metadata!, scroll: request.preview.scroll } },
      png,
    ),
  ).toThrow("camera");
  expect(() =>
    verifyCapture(
      request,
      { ...observation, metadata: { ...observation.metadata!, steps: 1 } },
      png,
    ),
  ).toThrow();
  expect(() =>
    verifyCapture(
      request,
      { ...observation, resources: [{ sha256: hash("other build"), url: request.url }] },
      png,
    ),
  ).toThrow("build");
  expect(() =>
    verifyCapture(
      request,
      { ...observation, canvas: { ...observation.canvas, cssWidth: 800 } },
      png,
    ),
  ).toThrow("geometry");
  const small = encodeRgbaPng(
    { deflateLevel: 9, deflateStrategy: 0, filterType: -1 },
    { data: new Uint8Array(4), height: 1, width: 1 },
  );
  expect(() => verifyCapture(request, observation, small)).toThrow("720x360");
});

it("provides a standalone public browser probe and native CLI help without capture", () => {
  expect(typeof new Script(`(${observePreviewCapture.toString()})`).runInNewContext()).toBe(
    "function",
  );
  expect(observePreviewCapture.toString()).toContain('"chibi-preview"');
  const help = execFileSync(
    process.execPath,
    [resolve("src/tools/stagePreviewCapture.ts"), "--help"],
    { encoding: "utf8" },
  );
  expect(help).toContain("Prepare does not capture");
  expect(help).toContain("--build-receipt");
});
