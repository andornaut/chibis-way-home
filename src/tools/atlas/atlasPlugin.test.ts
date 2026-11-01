import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { encodeLosslessWebp } from "@andornaut/game-kit/art/webp";
import { expect, it, vi } from "vitest";

import art from "../../../public/art/manifest.json";
import bird from "../../../public/art/sprites/bird.json";
import type { AtlasManifest } from "../../assets/atlasManifest";
import { ATLAS_MODULE, atlasPlugin } from "./atlasPlugin";
import { atlasPageFileName } from "./hashedArt";

vi.mock("@andornaut/game-kit/art/webp", () => ({
  encodeLosslessWebp: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

it("emits hashed atlas assets and exposes their dimensions, frames and URLs to the game", async () => {
  const plugin = atlasPlugin();
  const publicDir = join(import.meta.dirname, "../../../public");
  const emitted: { fileName: string; source: Uint8Array; type: string }[] = [];
  const source = art.sprites.find(({ key }) => key === "bird")!;
  const manifest = { backdrops: [], fonts: [], sprites: [source], tilesets: [] };
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
  expect(resolve("other-module")).toBeUndefined();
  expect(load("other-module")).toBeUndefined();
  await build.call(context);
  const moduleUrl = `data:text/javascript,${encodeURIComponent(load(resolve(ATLAS_MODULE)!)!)}`;
  const result = (await import(/* @vite-ignore */ moduleUrl)).default as AtlasManifest;
  expect(emitted).toHaveLength(1);
  expect(emitted[0]!.fileName).toBe(atlasPageFileName(0, "webp", emitted[0]!.source));
  expect(emitted[0]!.type).toBe("asset");
  expect(result.pages.map(({ url }) => url)).toEqual([`/${emitted[0]!.fileName}`]);
  expect(plugin.api.pageUrls()).toEqual(result.pages.map(({ url }) => url));
  const image = vi.mocked(encodeLosslessWebp).mock.calls[0]![0];
  expect(result.pages[0]).toMatchObject({ height: image.height, width: image.width });
  expect(result.textures.map(({ key, page }) => ({ key, page }))).toEqual([
    { key: "bird", page: 0 },
  ]);
  expect(result.textures[0]!.tags).toEqual(bird.meta.frameTags);
  expect(result.textures[0]!.frames.map(({ duration, name }) => ({ duration, name }))).toEqual(
    Object.entries(bird.frames).map(([name, frame]) => ({ duration: frame.duration, name })),
  );
});
