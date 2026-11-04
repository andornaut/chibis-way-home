/**
 * Compare a Python art generator with its TypeScript port on two repository copies.
 *
 * Runs `python -I art/tools/<tool>.py ARGS` in the Python root and `node art/tools/<entry>.ts
 * ARGS` in the TypeScript root, then compares every file either run wrote (by content or
 * modification time) or deleted:
 *   PNG        decoded RGBA and dimensions; first differing pixel
 *   JSON       canonical parse; first differing key path (byte equality reported too)
 *   .aseprite  decoded frames (composited RGBA), durations, tags and slices
 *   BMFont     identical bytes, otherwise glyph metrics, kernings and each glyph's atlas ink
 *   other      bytes
 * An ARGS value containing {out} has it replaced with <root>/.parity-out, which is compared
 * like any other path. Writes <results>/<label>.json and exits 0 only on exact parity.
 *
 * Usage, normally through parity.sh:
 *   node art/tools/parity.ts --tool NAME --py ROOT --ts ROOT --results DIR
 *     [--label LABEL] [--entry FILE.ts] [--python EXE] -- ARGS...
 *   node art/tools/parity.ts --decode FILE.aseprite   print the decoded summary as JSON
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { parseArgs } from "node:util";
import { inflateSync } from "node:zlib";

import { decodePng } from "@andornaut/art-kit/png";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

const SKIPPED_DIRECTORIES = new Set([".git", ".venv-art", "__pycache__", "node_modules"]);

interface Run {
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
}

interface AssetResult {
  path: string;
  kind: "png" | "json" | "aseprite" | "font" | "font-atlas" | "bytes";
  exact: boolean;
  bytesEqual: boolean;
  difference?: unknown;
}

type Snapshot = Map<string, string>;

function snapshot(root: string): Snapshot {
  const files: Snapshot = new Map();
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(path);
      } else if (entry.isFile()) {
        // The modification time detects a rewrite with unchanged bytes.
        const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
        const modified = statSync(path, { bigint: true }).mtimeNs;
        files.set(relative(root, path).split("\\").join("/"), `${hash} ${modified}`);
      }
    }
  };
  walk(root);
  return files;
}

function changed(before: Snapshot, after: Snapshot): Set<string> {
  const paths = new Set<string>();
  for (const [path, hash] of after) if (before.get(path) !== hash) paths.add(path);
  for (const path of before.keys()) if (!after.has(path)) paths.add(path);
  return paths;
}

function run(command: string, args: readonly string[], cwd: string): Run {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr.length > 4000 ? `...${result.stderr.slice(-4000)}` : result.stderr,
  };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && Buffer.compare(a, b) === 0;
}

function firstPixelDifference(a: RgbaImage, b: RgbaImage): unknown {
  if (a.width !== b.width || a.height !== b.height)
    return { size: { py: [a.width, a.height], ts: [b.width, b.height] } };
  let count = 0;
  let first: unknown;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2] ||
      a.data[i + 3] !== b.data[i + 3]
    ) {
      count++;
      first ??= {
        x: (i / 4) % a.width,
        y: Math.floor(i / 4 / a.width),
        py: [...a.data.subarray(i, i + 4)],
        ts: [...b.data.subarray(i, i + 4)],
      };
    }
  }
  return first === undefined ? undefined : { firstPixel: first, differingPixels: count };
}

function firstJsonDifference(a: unknown, b: unknown, path = "$"): unknown {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length || i >= b.length) return { path: `${path}[${i}]`, py: a[i], ts: b[i] };
      const found = firstJsonDifference(a[i], b[i], `${path}[${i}]`);
      if (found) return found;
    }
    return undefined;
  }
  if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const key of keys) {
      const child = `${path}.${key}`;
      if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key))
        return {
          path: child,
          py: (a as Record<string, unknown>)[key],
          ts: (b as Record<string, unknown>)[key],
        };
      const found = firstJsonDifference(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        child,
      );
      if (found) return found;
    }
    return undefined;
  }
  return Object.is(a, b) ? undefined : { path, py: a, ts: b };
}

interface AsepriteFrame {
  duration: number;
  rgba: RgbaImage;
}
interface AsepriteDocument {
  width: number;
  height: number;
  depth: number;
  frames: AsepriteFrame[];
  tags: { name: string; from: number; to: number; direction: number; repeat: number }[];
  slices: { name: string; flags: number; keys: number[][] }[];
}

/** Decode an RGBA (32-bit) Aseprite file: visible normal layers composited per frame. */
function decodeAseprite(bytes: Uint8Array): AsepriteDocument {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(4, true) !== 0xa5e0) throw new Error("Not an Aseprite file");
  const frameCount = view.getUint16(6, true);
  const width = view.getUint16(8, true);
  const height = view.getUint16(10, true);
  const depth = view.getUint16(12, true);
  if (depth !== 32) throw new Error(`Unsupported Aseprite colour depth ${depth}`);
  const layers: { visible: boolean; opacity: number }[] = [];
  const frames: AsepriteFrame[] = [];
  const tags: AsepriteDocument["tags"] = [];
  const slices: AsepriteDocument["slices"] = [];
  const cels: Map<
    number,
    { x: number; y: number; w: number; h: number; opacity: number; px: Uint8Array }
  >[] = [];
  const text = (offset: number): [string, number] => {
    const length = view.getUint16(offset, true);
    return [
      Buffer.from(bytes.subarray(offset + 2, offset + 2 + length)).toString("utf8"),
      offset + 2 + length,
    ];
  };
  let offset = 128;
  for (let f = 0; f < frameCount; f++) {
    const frameBytes = view.getUint32(offset, true);
    if (view.getUint16(offset + 4, true) !== 0xf1fa) throw new Error("Bad Aseprite frame");
    const oldChunks = view.getUint16(offset + 6, true);
    const duration = view.getUint16(offset + 8, true);
    const newChunks = view.getUint32(offset + 12, true);
    const chunks = newChunks || oldChunks;
    const frameCels = new Map<
      number,
      { x: number; y: number; w: number; h: number; opacity: number; px: Uint8Array }
    >();
    cels.push(frameCels);
    let chunk = offset + 16;
    for (let c = 0; c < chunks; c++) {
      const size = view.getUint32(chunk, true);
      const type = view.getUint16(chunk + 4, true);
      const at = chunk + 6;
      if (type === 0x2004) {
        const flags = view.getUint16(at, true);
        layers.push({ visible: (flags & 1) === 1, opacity: view.getUint8(at + 12) });
      } else if (type === 0x2005) {
        const layer = view.getUint16(at, true);
        const x = view.getInt16(at + 2, true);
        const y = view.getInt16(at + 4, true);
        const opacity = view.getUint8(at + 6);
        const celType = view.getUint16(at + 7, true);
        const data = at + 16;
        if (celType === 1) {
          const linked = cels[view.getUint16(data, true)]?.get(layer);
          if (linked) frameCels.set(layer, linked);
        } else if (celType === 0 || celType === 2) {
          const w = view.getUint16(data, true);
          const h = view.getUint16(data + 2, true);
          const raw = bytes.subarray(data + 4, chunk + size);
          const px = celType === 0 ? raw.slice(0, w * h * 4) : new Uint8Array(inflateSync(raw));
          frameCels.set(layer, { x, y, w, h, opacity, px });
        } else {
          throw new Error(`Unsupported Aseprite cel type ${celType}`);
        }
      } else if (type === 0x2018) {
        const count = view.getUint16(at, true);
        let tag = at + 10;
        for (let t = 0; t < count; t++) {
          const from = view.getUint16(tag, true);
          const to = view.getUint16(tag + 2, true);
          const direction = view.getUint8(tag + 4);
          const repeat = view.getUint16(tag + 5, true);
          const [name, next] = text(tag + 17);
          tags.push({ name, from, to, direction, repeat });
          tag = next;
        }
      } else if (type === 0x2022) {
        const keyCount = view.getUint32(at, true);
        const flags = view.getUint32(at + 4, true);
        const [name, start] = text(at + 12);
        let key = start;
        const keys: number[][] = [];
        for (let k = 0; k < keyCount; k++) {
          const fields = [
            view.getUint32(key, true),
            view.getInt32(key + 4, true),
            view.getInt32(key + 8, true),
            view.getUint32(key + 12, true),
            view.getUint32(key + 16, true),
          ];
          key += 20;
          if (flags & 1) {
            fields.push(
              view.getInt32(key, true),
              view.getInt32(key + 4, true),
              view.getUint32(key + 8, true),
              view.getUint32(key + 12, true),
            );
            key += 16;
          }
          if (flags & 2) {
            fields.push(view.getInt32(key, true), view.getInt32(key + 4, true));
            key += 8;
          }
          keys.push(fields);
        }
        slices.push({ name, flags, keys });
      }
      chunk += size;
    }
    const rgba = { width, height, data: new Uint8Array(width * height * 4) };
    [...frameCels.entries()]
      .sort(([a], [b]) => a - b)
      .forEach(([layerIndex, cel]) => {
        const layer = layers[layerIndex];
        if (!layer?.visible) return;
        for (let y = 0; y < cel.h; y++)
          for (let x = 0; x < cel.w; x++) {
            const tx = cel.x + x;
            const ty = cel.y + y;
            if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
            const s = (y * cel.w + x) * 4;
            const alpha = Math.round(
              ((cel.px[s + 3] ?? 0) * cel.opacity * layer.opacity) / (255 * 255),
            );
            if (!alpha) continue;
            const d = (ty * width + tx) * 4;
            const below = rgba.data[d + 3] ?? 0;
            const out = alpha + (below * (255 - alpha)) / 255;
            for (let i = 0; i < 3; i++)
              rgba.data[d + i] = Math.round(
                ((cel.px[s + i] ?? 0) * alpha +
                  (rgba.data[d + i] ?? 0) * below * (1 - alpha / 255)) /
                  out,
              );
            rgba.data[d + 3] = Math.round(out);
          }
      });
    frames.push({ duration, rgba });
    offset += frameBytes;
  }
  return { width, height, depth, frames, tags, slices };
}

function compareAseprite(a: Uint8Array, b: Uint8Array): unknown {
  const py = decodeAseprite(a);
  const ts = decodeAseprite(b);
  if (py.width !== ts.width || py.height !== ts.height)
    return { size: { py: [py.width, py.height], ts: [ts.width, ts.height] } };
  if (py.frames.length !== ts.frames.length)
    return { frames: { py: py.frames.length, ts: ts.frames.length } };
  for (let i = 0; i < py.frames.length; i++) {
    const [first, second] = [py.frames[i] as AsepriteFrame, ts.frames[i] as AsepriteFrame];
    if (first.duration !== second.duration)
      return { frame: i, duration: { py: first.duration, ts: second.duration } };
    const pixel = firstPixelDifference(first.rgba, second.rgba);
    if (pixel) return { frame: i, ...(pixel as object) };
  }
  return (
    firstJsonDifference(py.tags, ts.tags, "$tags") ??
    firstJsonDifference(py.slices, ts.slices, "$slices")
  );
}

interface FontDocument {
  head: Record<string, Record<string, string>>;
  pages: string[];
  chars: Map<string, Record<string, string>>;
  kernings: string[];
}

function attributes(text: string): Record<string, string> {
  return Object.fromEntries([...text.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

function parseFont(text: string): FontDocument {
  const head: FontDocument["head"] = {};
  for (const tag of ["info", "common"]) {
    const match = new RegExp(`<${tag}\\s([^>]*)/?>`).exec(text);
    head[tag] = match ? attributes(match[1] as string) : {};
  }
  const pages = [...text.matchAll(/<page\s([^>]*)\/>/g)].map(
    (m) => attributes(m[1] as string).file ?? "",
  );
  const chars = new Map<string, Record<string, string>>();
  for (const m of text.matchAll(/<char\s([^>]*)\/>/g)) {
    const values = attributes(m[1] as string);
    chars.set(values.id ?? "", values);
  }
  const kernings = [...text.matchAll(/<kerning\s([^>]*)\/>/g)].map((m) => {
    const k = attributes(m[1] as string);
    return `${k.first},${k.second},${k.amount}`;
  });
  return { head, pages, chars, kernings };
}

function isFont(path: string, bytes: Uint8Array): boolean {
  if (!/\.(fnt|xml)$/.test(path)) return false;
  return /<font>/.test(Buffer.from(bytes.subarray(0, 4096)).toString("utf8"));
}

function glyph(image: RgbaImage, values: Record<string, string>): Uint8Array {
  const [x, y, w, h] = ["x", "y", "width", "height"].map((k) => Number(values[k] ?? 0)) as [
    number,
    number,
    number,
    number,
  ];
  const out = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++)
    out.set(
      image.data.subarray(((y + row) * image.width + x) * 4, ((y + row) * image.width + x + w) * 4),
      row * w * 4,
    );
  return out;
}

/** Compare metrics apart from atlas placement, then each glyph's ink. */
function compareFont(
  pyRoot: string,
  tsRoot: string,
  path: string,
  a: Uint8Array,
  b: Uint8Array,
): unknown {
  const py = parseFont(Buffer.from(a).toString("utf8"));
  const ts = parseFont(Buffer.from(b).toString("utf8"));
  const placement = new Set(["scaleW", "scaleH"]);
  const head = (font: FontDocument) =>
    Object.fromEntries(
      Object.entries(font.head).map(([tag, values]) => [
        tag,
        Object.fromEntries(Object.entries(values).filter(([k]) => !placement.has(k))),
      ]),
    );
  const headDifference = firstJsonDifference(head(py), head(ts), "$head");
  if (headDifference) return headDifference;
  const kerning = firstJsonDifference(py.kernings, ts.kernings, "$kernings");
  if (kerning) return kerning;
  const ids = [...new Set([...py.chars.keys(), ...ts.chars.keys()])];
  const atlas = (root: string, font: FontDocument) =>
    decodePng(readFileSync(join(root, posix.dirname(path), font.pages[0] ?? "")));
  const pyAtlas = atlas(pyRoot, py);
  const tsAtlas = atlas(tsRoot, ts);
  for (const id of ids) {
    const first = py.chars.get(id);
    const second = ts.chars.get(id);
    if (!first || !second) return { char: id, py: first, ts: second };
    for (const key of ["width", "height", "xoffset", "yoffset", "xadvance", "page", "chnl"])
      if (first[key] !== second[key])
        return { char: id, metric: key, py: first[key], ts: second[key] };
    const inkA = glyph(pyAtlas, first);
    const inkB = glyph(tsAtlas, second);
    if (!bytesEqual(inkA, inkB)) {
      const width = Number(first.width);
      const pixel = firstPixelDifference(
        { width, height: Number(first.height), data: inkA },
        { width, height: Number(first.height), data: inkB },
      );
      return { char: id, ink: pixel };
    }
  }
  return undefined;
}

function compare(pyRoot: string, tsRoot: string, paths: readonly string[]): AssetResult[] {
  const results: AssetResult[] = [];
  const read = (root: string, path: string) => {
    const file = join(root, path);
    return existsSync(file) ? new Uint8Array(readFileSync(file)) : undefined;
  };
  const fontAtlases = new Map<string, string>();
  for (const path of paths) {
    const bytes = read(pyRoot, path) ?? read(tsRoot, path);
    if (bytes && isFont(path, bytes))
      for (const page of parseFont(Buffer.from(bytes).toString("utf8")).pages)
        fontAtlases.set(posix.join(posix.dirname(path), page), path);
  }
  for (const path of paths) {
    const a = read(pyRoot, path);
    const b = read(tsRoot, path);
    const same = a !== undefined && b !== undefined && bytesEqual(a, b);
    const font = a ? isFont(path, a) : false;
    const kind: AssetResult["kind"] = font
      ? "font"
      : fontAtlases.has(path)
        ? "font-atlas"
        : path.endsWith(".png")
          ? "png"
          : path.endsWith(".json")
            ? "json"
            : path.endsWith(".aseprite")
              ? "aseprite"
              : "bytes";
    if (a === undefined || b === undefined) {
      results.push({
        path,
        kind,
        exact: false,
        bytesEqual: false,
        difference: { missing: a === undefined ? "py" : "ts" },
      });
      continue;
    }
    let difference: unknown;
    try {
      // A font with identical bytes can still name a changed atlas.
      if (same && kind !== "font") difference = undefined;
      else if (kind === "png") difference = firstPixelDifference(decodePng(a), decodePng(b));
      else if (kind === "json")
        difference = firstJsonDifference(
          JSON.parse(Buffer.from(a).toString("utf8")),
          JSON.parse(Buffer.from(b).toString("utf8")),
        );
      else if (kind === "aseprite") difference = compareAseprite(a, b);
      else if (kind === "font") difference = compareFont(pyRoot, tsRoot, path, a, b);
      else if (kind === "font-atlas") difference = { comparedBy: fontAtlases.get(path) };
      else difference = { bytes: "differ", py: a.length, ts: b.length };
    } catch (error) {
      difference = { error: String(error) };
    }
    const exact = difference === undefined;
    results.push({ path, kind, exact, bytesEqual: same, ...(exact ? {} : { difference }) });
  }
  // A font atlas is exact when its font, which may sort after it, has exact metrics and ink.
  for (const result of results)
    if (result.kind === "font-atlas" && !result.bytesEqual) {
      result.exact = results.some((r) => r.path === fontAtlases.get(result.path) && r.exact);
      if (result.exact) delete result.difference;
    }
  return results;
}

const camel = (name: string) => name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    decode: { type: "string" },
    entry: { type: "string" },
    label: { type: "string" },
    py: { type: "string" },
    python: { type: "string", default: "python3" },
    results: { type: "string" },
    tool: { type: "string" },
    ts: { type: "string" },
  },
});
if (values.decode) {
  const document = decodeAseprite(new Uint8Array(readFileSync(values.decode)));
  const summary = {
    ...document,
    frames: document.frames.map(({ duration, rgba }) => ({
      duration,
      rgbaSha256: createHash("sha256").update(rgba.data).digest("hex"),
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}
if (!values.tool || !values.py || !values.ts || !values.results) {
  console.error(
    "Usage: parity.ts --tool NAME --py ROOT --ts ROOT --results DIR [--label L] [--entry F.ts] [--python EXE] -- ARGS...",
  );
  process.exit(2);
}
const tool = values.tool;
const roots = { py: values.py, ts: values.ts };
const entry = values.entry ?? `art/tools/${camel(tool)}.ts`;
const label =
  values.label ?? [tool, ...positionals.filter((arg) => !arg.includes("{out}"))].join("-");
const argsFor = (root: string) => {
  mkdirSync(join(root, ".parity-out"), { recursive: true });
  return positionals.map((arg) => arg.replaceAll("{out}", join(root, ".parity-out")));
};
const before = { py: snapshot(roots.py), ts: snapshot(roots.ts) };
const python = run(values.python, ["-I", `art/tools/${tool}.py`, ...argsFor(roots.py)], roots.py);
const typescript = run(process.execPath, [entry, ...argsFor(roots.ts)], roots.ts);
const after = { py: snapshot(roots.py), ts: snapshot(roots.ts) };
const paths = [
  ...new Set([...changed(before.py, after.py), ...changed(before.ts, after.ts)]),
].sort();
const assets = compare(roots.py, roots.ts, paths);
const statusEqual = python.status === typescript.status && python.signal === typescript.signal;
const exact = statusEqual && python.status === 0 && assets.every((asset) => asset.exact);
const result = {
  tool,
  entry,
  args: positionals,
  exact,
  python,
  typescript,
  stdoutEqual: python.stdout === typescript.stdout,
  assets,
};
const out = join(values.results, `${label}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `${exact ? "exact" : "NOT EXACT"} ${label}: ${assets.filter((a) => a.exact).length}/${assets.length} assets exact; ${out}`,
);
process.exit(exact ? 0 : 1);
