import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { decodePng } from "@andornaut/art-kit/build/png";

import { STAGE_PREVIEW } from "../data/layout.ts";
import { SCREEN } from "../data/screen.ts";
import { STAGE_PREVIEWS } from "../data/stagePreviews.ts";
import { askedStagePreview, type StagePreview, stagePreviewScroll } from "../rules/stagePreview.ts";

export interface CaptureFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}
export interface CaptureBuild {
  readonly source: string;
  readonly artifact: { readonly treeSha256: string };
}
export interface PreviewMetadata {
  readonly area: string;
  readonly areaSize: { readonly width: number; readonly height: number };
  readonly assemblySeed: number;
  readonly camera: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly zoom: number;
  };
  readonly inputEnabled: boolean;
  readonly motionSeed: number;
  readonly scroll: { readonly x: number; readonly y: number };
  readonly stage: string;
  readonly steps: number;
}
export interface CaptureObservation {
  readonly observedAt: string;
  readonly url: string;
  readonly ready: boolean;
  readonly stage: string | undefined;
  readonly metadata: PreviewMetadata | undefined;
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly cssWidth: number;
    readonly cssHeight: number;
    readonly dpr: number;
  };
  readonly resources: readonly { readonly url: string; readonly sha256: string }[];
}
export interface CaptureRequest {
  readonly status: "prepared";
  readonly source: string;
  readonly buildReceiptSha256: string;
  readonly dist: readonly CaptureFile[];
  readonly distSha256: string;
  readonly preview: StagePreview;
  readonly imageKey: string;
  readonly url: string;
}
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const treeHash = (files: readonly CaptureFile[]) =>
  digest(JSON.stringify(files, ["path", "bytes", "sha256"]));

// This recipe matches the owner build receipt's sorted dist/ file manifest.
export function captureDist(directory: string): readonly CaptureFile[] {
  const files: CaptureFile[] = [];
  const visit = (relative: string) => {
    for (const name of readdirSync(join(directory, relative))) {
      const at = join(relative, name);
      const path = join(directory, at);
      const info = lstatSync(path);
      if (info.isDirectory()) {
        visit(at);
      } else if (info.isFile()) {
        const bytes = readFileSync(path);
        files.push({
          bytes: bytes.length,
          path: `dist/${at.replaceAll("\\", "/")}`,
          sha256: digest(bytes),
        });
      } else {
        throw new Error("Capture dist must contain only regular files and directories");
      }
    }
  };
  visit("");
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function prepareCapture(
  context: {
    readonly origin: string;
    readonly source: string;
    readonly build: CaptureBuild;
    readonly buildReceiptSha256: string;
    readonly dist: readonly CaptureFile[];
  },
  search: string,
): CaptureRequest {
  const origin = new URL(context.origin);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  ) {
    throw new Error("Use the existing local preview origin");
  }
  const preview = askedStagePreview(Object.keys(STAGE_PREVIEWS), search);
  if (
    !preview ||
    !/^[a-f0-9]{40}$/.test(context.source) ||
    !/^[a-f0-9]{64}$/.test(context.buildReceiptSha256) ||
    context.build.source !== context.source ||
    context.build.artifact.treeSha256 !== treeHash(context.dist) ||
    !context.dist.some(({ path }) => path === "dist/play/index.html")
  ) {
    throw new Error("Missing or mismatched exact source/build/dist evidence");
  }
  const url = new URL("/play/", origin);
  url.searchParams.set("stagePreview", preview.key);
  url.searchParams.set("assembly", String(preview.assemblySeed));
  url.searchParams.set("seed", String(preview.motionSeed));
  url.searchParams.set("previewX", String(preview.scroll.x));
  url.searchParams.set("previewY", String(preview.scroll.y));
  if (preview.area !== undefined) {
    url.searchParams.set("previewArea", preview.area);
  }
  return {
    buildReceiptSha256: context.buildReceiptSha256,
    dist: context.dist,
    distSha256: treeHash(context.dist),
    imageKey: STAGE_PREVIEWS[preview.key]!,
    preview,
    source: context.source,
    status: "prepared",
    url: url.href,
  };
}

// Run this function through the existing browser's evaluate tool, never through a new browser.
// Its observations are caller-supplied evidence; the CLI validates consistency, not authenticity.
export async function observePreviewCapture(): Promise<CaptureObservation> {
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ||
    location.pathname !== "/play/" ||
    !new URLSearchParams(location.search).has("stagePreview")
  ) {
    throw new Error("Use the prepared local preview page");
  }
  const canvas = document.querySelector<HTMLCanvasElement>("#game canvas");
  if (!canvas) {
    throw new Error("No preview canvas");
  }
  const rect = canvas.getBoundingClientRect();
  const urls = new Set(
    [
      location.href,
      ...performance.getEntriesByType("resource").map(({ name }) => name),
      ...[...document.querySelectorAll<HTMLScriptElement>("script[src]")].map(({ src }) => src),
      ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
        ({ href }) => href,
      ),
    ].filter((url) => new URL(url).origin === location.origin),
  );
  const resources = await Promise.all(
    [...urls].map(async (url) => {
      const response = await fetch(url, { credentials: "omit" });
      if (!response.ok) {
        throw new Error("Cannot observe served preview resource");
      }
      const bytes = await response.arrayBuffer();
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      return {
        sha256: [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, "0")).join(""),
        url,
      };
    }),
  );
  return {
    canvas: {
      cssHeight: rect.height,
      cssWidth: rect.width,
      dpr: devicePixelRatio,
      height: canvas.height,
      width: canvas.width,
    },
    metadata: canvas.dataset.stagePreviewMetadata
      ? (JSON.parse(canvas.dataset.stagePreviewMetadata) as PreviewMetadata)
      : undefined,
    observedAt: new Date().toISOString(),
    ready: canvas.dataset.stagePreviewReady === "true",
    resources,
    stage: canvas.dataset.stagePreview,
    url: location.href,
  };
}

export function verifyCapture(
  request: CaptureRequest,
  observation: CaptureObservation,
  png: Uint8Array,
) {
  const metadata = observation.metadata;
  const view = observation.canvas;
  if (
    request.status !== "prepared" ||
    !/^[a-f0-9]{40}$/.test(request.source) ||
    !/^[a-f0-9]{64}$/.test(request.buildReceiptSha256) ||
    STAGE_PREVIEWS[request.preview.key] === undefined ||
    request.imageKey !== STAGE_PREVIEWS[request.preview.key] ||
    treeHash(request.dist) !== request.distSha256 ||
    observation.url !== request.url ||
    observation.ready !== true ||
    observation.stage !== request.preview.key ||
    !metadata ||
    metadata.stage !== request.preview.key ||
    metadata.steps !== 0 ||
    metadata.inputEnabled !== false ||
    metadata.assemblySeed !== request.preview.assemblySeed ||
    metadata.motionSeed !== request.preview.motionSeed ||
    !metadata.area ||
    (request.preview.area !== undefined && metadata.area !== request.preview.area)
  ) {
    throw new Error("Missing or mismatched actual frozen-preview observation");
  }
  const dimensions = [
    view.width,
    view.height,
    view.cssWidth,
    view.cssHeight,
    view.dpr,
    metadata.areaSize.width,
    metadata.areaSize.height,
    metadata.camera.width,
    metadata.camera.height,
    metadata.camera.zoom,
  ];
  if (
    !dimensions.every((value) => Number.isFinite(value) && value > 0) ||
    view.cssWidth !== SCREEN.width ||
    view.cssHeight !== SCREEN.height ||
    metadata.camera.x !== 0 ||
    metadata.camera.y !== 0 ||
    metadata.camera.width !== view.width ||
    metadata.camera.height !== view.height ||
    metadata.camera.zoom !== view.width / SCREEN.width ||
    view.width / view.height !== SCREEN.width / SCREEN.height
  ) {
    throw new Error("Preview capture has unsupported letterbox, scale or canvas geometry");
  }
  const expectedScroll = stagePreviewScroll(SCREEN, metadata.areaSize, request.preview.scroll);
  if (metadata.scroll.x !== expectedScroll.x || metadata.scroll.y !== expectedScroll.y) {
    throw new Error("Actual camera does not match clamped preview request");
  }
  const expected = new Map(request.dist.map((file) => [file.path, file.sha256]));
  const observed = new Map<string, string>();
  for (const resource of observation.resources) {
    const url = new URL(resource.url);
    if (url.origin !== new URL(request.url).origin) {
      throw new Error("Unexpected capture resource origin");
    }
    const path = `dist${url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname}`;
    if (expected.get(path) !== resource.sha256) {
      throw new Error("Served resource differs from exact build");
    }
    observed.set(path, resource.sha256);
  }
  const page = request.dist.find(({ path }) => path === "dist/play/index.html")!;
  if (
    observed.get(page.path) !== page.sha256 ||
    ![...observed.keys()].some((path) => path.endsWith(".js")) ||
    !Number.isFinite(Date.parse(observation.observedAt))
  ) {
    throw new Error("Missing actual page, script or observation time");
  }
  const rawSha256 = digest(png);
  const image = decodePng(png);
  if (digest(png) !== rawSha256) {
    throw new Error("Raw PNG changed during validation");
  }
  if (image.width !== SCREEN.width || image.height !== SCREEN.height) {
    throw new Error("Raw preview PNG must remain 720x360");
  }
  return {
    art: {
      imageKey: request.imageKey,
      operation:
        "Art uses this same raw hash, nearest-neighbour resize once, existing PNG export policy",
      size: STAGE_PREVIEW,
    },
    authority:
      "Caller-supplied browser observations checked against the exact owner build receipt; CLI did not capture",
    buildReceiptSha256: request.buildReceiptSha256,
    distSha256: request.distSha256,
    observation,
    raw: { bytes: png.length, height: image.height, sha256: rawSha256, width: image.width },
    request,
    source: request.source,
    status: "verified-observed-frame" as const,
  };
}

const USAGE = `Usage:
  node src/tools/stagePreviewCapture.ts prepare --dist DIR --build-receipt FILE \\
    --origin URL --stage KEY --assembly N --seed N --x N --y N [--area NAME] --out NEW_DIR
  node src/tools/stagePreviewCapture.ts verify --request FILE --observation FILE --png FILE --out NEW_FILE
Prepare does not capture. Run observe.js in the existing browser and capture its canvas as a 720x360 PNG.
Then verify. No browser is launched.`;

function main() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  if (process.argv.includes("--help")) {
    console.log(USAGE);
    return;
  }
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries(
      [
        "dist",
        "build-receipt",
        "origin",
        "stage",
        "assembly",
        "seed",
        "x",
        "y",
        "area",
        "out",
        "request",
        "observation",
        "png",
      ].map((key) => [key, { type: "string" as const }]),
    ),
  });
  const required = (name: string) => {
    const value = values[name];
    if (typeof value !== "string" || !value) {
      throw new Error(`Missing --${name}`);
    }
    return value;
  };
  const json = (name: string) => JSON.parse(readFileSync(required(name), "utf8"));
  if (positionals[0] === "prepare" && positionals.length === 1) {
    const source = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    if (
      execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
        cwd: root,
        encoding: "utf8",
      }).trim()
    ) {
      throw new Error("Prepare requires a clean source checkout");
    }
    const receipt = readFileSync(required("build-receipt"));
    const params = new URLSearchParams({
      assembly: required("assembly"),
      previewX: required("x"),
      previewY: required("y"),
      seed: required("seed"),
      stagePreview: required("stage"),
    });
    if (values.area !== undefined) {
      params.set("previewArea", required("area"));
    }
    const request = prepareCapture(
      {
        build: JSON.parse(receipt.toString()),
        buildReceiptSha256: digest(receipt),
        dist: captureDist(required("dist")),
        origin: required("origin"),
        source,
      },
      `?${params}`,
    );
    const out = required("out");
    mkdirSync(out);
    writeFileSync(join(out, "request.json"), `${JSON.stringify(request, null, 2)}\n`, {
      flag: "wx",
    });
    writeFileSync(join(out, "observe.js"), `(${observePreviewCapture.toString()})\n`, {
      flag: "wx",
    });
    console.log(
      JSON.stringify({
        observationFormat: "function",
        observationScript: join(out, "observe.js"),
        request: join(out, "request.json"),
        status: request.status,
        url: request.url,
      }),
    );
  } else if (positionals[0] === "verify" && positionals.length === 1) {
    const receipt = verifyCapture(
      json("request"),
      json("observation"),
      readFileSync(required("png")),
    );
    writeFileSync(required("out"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
    console.log(
      JSON.stringify({ imageKey: receipt.art.imageKey, raw: receipt.raw, status: receipt.status }),
    );
  } else {
    throw new Error(USAGE);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
