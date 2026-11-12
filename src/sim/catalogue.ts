import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { AsepriteSheet } from "@andornaut/game-kit/art/aseprite";

import {
  artHitboxes,
  type ArtManifest,
  CONTACT_SILHOUETTES,
  sheetFrameSize,
  spriteContacts,
} from "../assets/index.ts";
import { ARCHETYPES } from "../data/archetypes.ts";
import { BIRD } from "../data/bird.ts";
import { CHARACTERS } from "../data/characters.ts";
import { ZONE_MAP } from "../data/map.ts";
import { TILE } from "../data/screen.ts";
import type { SpriteSilhouettes } from "../data/types/index.ts";
import { zoneLayout } from "../rules/tiles.ts";
import { zonePlanFor } from "../rules/zonePlans.ts";
import type { Tileset } from "../stage/index.ts";
import { type PreparedStage, prepareStage } from "./simulate.ts";

// Art's frames, hitboxes and tilesets, read from the built art without a bundler.
export function nodeArt(artRoot = new URL("../../public/art/", import.meta.url)) {
  const read = <T>(path: string): T =>
    JSON.parse(readFileSync(new URL(path, artRoot), "utf8")) as T;
  const manifest = read<ArtManifest>("manifest.json");
  const frame = (key: string) => {
    const sprite = manifest.sprites.find((entry) => entry.key === key);
    if (!sprite) {
      throw new Error(`Missing sprite ${key}`);
    }
    return sheetFrameSize(read<Parameters<typeof sheetFrameSize>[0]>(sprite.json));
  };
  const mask = manifest.data.find((entry) => entry.key === CONTACT_SILHOUETTES);
  const contacts = spriteContacts(
    manifest,
    (key) => {
      const sprite = manifest.sprites.find((entry) => entry.key === key);
      if (!sprite) {
        throw new Error(`Missing contact sprite ${key}`);
      }
      return read<AsepriteSheet>(sprite.json);
    },
    frame,
    mask ? read<SpriteSilhouettes>(mask.json) : undefined,
  );
  const hitboxes = artHitboxes(frame, manifest, contacts);
  const birdFrame = frame("bird");
  const tilesets: Readonly<Record<string, Tileset>> = Object.fromEntries(
    manifest.tilesets.map(({ json, key }) => [key, read<Tileset>(json)]),
  );
  return { birdFrame, hitboxes, tilesets };
}

export function stageLoader(
  stage: string,
  artRoot = new URL("../../public/art/", import.meta.url),
) {
  const { birdFrame, hitboxes, tilesets } = nodeArt(artRoot);
  const node = ZONE_MAP.nodes.find(({ id }) => id === stage);
  const key = node?.kind === "zone" ? node.zone : stage;
  if (!key) {
    throw new Error(`Stage ${stage} is not implemented`);
  }
  const catalogue = { archetypes: ARCHETYPES, characters: CHARACTERS };
  let previous: { seed: number; stage: PreparedStage } | undefined;
  return (seed: number): PreparedStage => {
    if (previous?.seed === seed) {
      return previous.stage;
    }
    const plan = zonePlanFor(seed, key);
    const layout = zoneLayout(TILE, birdFrame, catalogue, hitboxes, tilesets, new Set(), plan);
    const stage = {
      ...prepareStage(layout),
      source: {
        chunkIds: Object.fromEntries(
          Object.entries(plan.areas).map(([area, value]) => [
            area,
            value.chunks?.map(({ chunk }) => chunk) ?? [],
          ]),
        ),
        layoutSeed: seed,
        provenance: {
          data: `sha256:${createHash("sha256")
            .update(JSON.stringify({ layout, plan, tuning: BIRD }))
            .digest("hex")}`,
        },
      },
    };
    previous = { seed, stage };
    return stage;
  };
}
