import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { encodeLosslessWebp } from "@andornaut/art-kit/build/webp";
import { expect, it, vi } from "vitest";

import art from "../../../public/art/manifest.json" with { type: "json" };
import bird from "../../../public/art/sprites/bird.json" with { type: "json" };
import { type AtlasManifest, BASE_FRAME } from "../../assets/index.ts";
import { STAGE_PREVIEWS } from "../../data/stagePreviews.ts";
import { ATLAS_MODULE, atlasPlugin } from "./atlasPlugin.ts";
import { atlasPageFileName } from "./hashedArt.ts";

vi.mock("@andornaut/art-kit/build/webp", () => ({
  encodeLosslessWebp: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

it("emits hashed atlas assets and exposes their dimensions, frames and URLs to the game", async () => {
  const plugin = atlasPlugin();
  const publicDir = join(import.meta.dirname, "../../../public");
  const emitted: { fileName: string; source: Uint8Array; type: string }[] = [];
  const source = art.sprites.find(({ key }) => key === "bird")!;
  const preview = art.images.find(({ key }) => key === STAGE_PREVIEWS.street)!;
  const logo = art.images.find(({ key }) => key === "logo")!;
  const manifest = { backdrops: [], images: [preview, logo], sprites: [source], tilesets: [] };
  const context = {
    emitFile: (asset: (typeof emitted)[number]) => emitted.push(asset),
    environment: { config: { command: "build", publicDir }, logger: { info: vi.fn() } },
    fs: {
      readFile: (path: string) =>
        path.endsWith("/manifest.json")
          ? Promise.resolve(new TextEncoder().encode(JSON.stringify(manifest)))
          : readFile(path),
    },
  };
  const build = plugin.buildStart as unknown as (this: typeof context) => Promise<void>;
  const resolve = plugin.resolveId as (id: string) => string | undefined;
  const load = plugin.load as (id: string) => string | undefined;
  expect(plugin.api.pageUrls()).toEqual([]);
  expect(plugin.api.textureKeys()).toEqual([]);
  expect(resolve("other-module")).toBeUndefined();
  expect(load("other-module")).toBeUndefined();
  await build.call(context);
  const moduleUrl = `data:text/javascript,${encodeURIComponent(load(resolve(ATLAS_MODULE)!)!)}`;
  const result = (await import(/* @vite-ignore */ moduleUrl)).default as AtlasManifest;
  expect(emitted).toHaveLength(2);
  expect(emitted[0]!.fileName).toBe(atlasPageFileName(0, "webp", emitted[0]!.source));
  expect(emitted[0]!.type).toBe("asset");
  expect(result.pages.map(({ url }) => url)).toEqual(emitted.map(({ fileName }) => `/${fileName}`));
  expect(plugin.api.pageUrls()).toEqual(result.pages.map(({ url }) => url));
  const image = vi.mocked(encodeLosslessWebp).mock.calls[0]![0];
  expect(result.pages[0]).toMatchObject({ height: image.height, width: image.width });
  expect(result.textures.map(({ key, page }) => ({ key, page }))).toEqual([
    { key: "bird", page: 0 },
    { key: preview.key, page: 1 },
  ]);
  expect(plugin.api.textureKeys()).toEqual(["bird", preview.key]);
  expect(result.textures[1]!.frames).toEqual([
    { h: preview.height, name: BASE_FRAME, w: preview.width, x: 1, y: 1 },
  ]);
  expect(result.textures[0]!.tags).toEqual(bird.meta.frameTags);
  expect(result.textures[0]!.frames.map(({ duration, name }) => ({ duration, name }))).toEqual(
    Object.entries(bird.frames).map(([name, frame]) => ({ duration: frame.duration, name })),
  );
});
