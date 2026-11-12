import { ART_PATH, type ArtManifest } from "../assets/index.ts";

export function galleryCatalogue(manifest: ArtManifest) {
  return [
    {
      id: "backdrops",
      items: manifest.backdrops.map((asset) => ({
        ...asset,
        kind: "image" as const,
        png: ART_PATH + asset.png,
      })),
      title: "Backdrops",
    },
    {
      id: "data",
      items: manifest.data.map((asset) => ({
        ...asset,
        json: ART_PATH + asset.json,
        kind: "data" as const,
      })),
      title: "Data",
    },
    {
      id: "fonts",
      items: manifest.fonts.map((asset) => ({
        ...asset,
        fnt: ART_PATH + asset.fnt,
        kind: "font" as const,
        png: ART_PATH + asset.png,
      })),
      title: "Fonts",
    },
    {
      id: "images",
      items: manifest.images.map((asset) => ({
        ...asset,
        kind: "image" as const,
        png: ART_PATH + asset.png,
      })),
      title: "Images",
    },
    {
      id: "sprites",
      items: manifest.sprites.map((asset) => ({
        ...asset,
        json: ART_PATH + asset.json,
        kind: "sprite" as const,
        png: ART_PATH + asset.png,
      })),
      title: "Sprites",
    },
    {
      id: "tilesets",
      items: manifest.tilesets.map((asset) => ({
        ...asset,
        json: ART_PATH + asset.json,
        kind: "image" as const,
        png: ART_PATH + asset.png,
      })),
      title: "Tilesets",
    },
  ];
}
export type GalleryItem = ReturnType<typeof galleryCatalogue>[number]["items"][number];
