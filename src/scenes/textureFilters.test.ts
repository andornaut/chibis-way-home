import { describe, expect, it, vi } from "vitest";

import manifestJson from "../../public/art/manifest.json" with { type: "json" };
import { type ArtManifest, atlasPageKey } from "../assets/index.ts";

const manifest = manifestJson as unknown as ArtManifest;

vi.mock("phaser", () => ({ Textures: { FilterMode: { LINEAR: 0, NEAREST: 1 } } }));

import { filterLoadedArt, MANIFEST_FILTERS, textureFilters } from "./textureFilters.ts";

describe("texture filters", () => {
  // A texture list art adds to the manifest needs a filter before it loads.
  it("classify every texture list in art's manifest", () => {
    const lists = Object.keys(manifest).filter((list) => list !== "data" && list !== "fonts");
    expect(lists.sort()).toEqual(Object.keys(MANIFEST_FILTERS).sort());
  });

  it("sample runtime textures nearest and leave preview bitmap fonts outside the runtime graph", () => {
    const pages = [{ height: 1, url: "atlas-0.webp", width: 1 }];
    const filters = textureFilters(manifest, { pages });
    const keys = Object.keys(MANIFEST_FILTERS).flatMap((list) =>
      manifest[list as keyof typeof MANIFEST_FILTERS].map(({ key }) => key),
    );
    expect([...filters.keys()].sort()).toEqual([...keys, atlasPageKey(0)].sort());
    expect([...filters.values()].every((filter) => filter === "nearest")).toBe(true);
    expect(manifest.fonts.some(({ key }) => filters.has(key))).toBe(false);
  });

  it("set each loaded texture's source and skip one that failed to load", () => {
    const font = { setFilter: vi.fn() };
    const page = { setFilter: vi.fn() };
    const list: Record<string, { source: { setFilter: ReturnType<typeof vi.fn> }[] }> = {
      [atlasPageKey(0)]: { source: [page] },
      "font-body": { source: [font] },
      sprite: { source: [page] },
    };
    const textures = { exists: (key: string) => key in list, get: (key: string) => list[key] };
    const art = {
      backdrops: [],
      fonts: [{ fnt: "body.fnt", key: "font-body", png: "body.png" }],
      images: [{ key: "missing", png: "missing.png" }],
      sprites: [{ json: "sprite.json", key: "sprite", once: [], png: "sprite.png" }],
      tilesets: [],
    };
    filterLoadedArt({ textures } as never, art as unknown as ArtManifest, {
      pages: [{ height: 1, url: "", width: 1 }],
    });
    expect(font.setFilter).not.toHaveBeenCalled();
    expect(page.setFilter).toHaveBeenCalledExactlyOnceWith(1);
  });
});
