import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { AsepriteSheet } from "@andornaut/game-kit/runtime/art/aseprite";

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
import type { SpriteSilhouettes, ZonePlan } from "../data/types/index.ts";
import {
  planStage,
  recipeKey,
  requirePlanned,
  STAGE_CONTEXT,
  stageTarget,
  zoneLayout,
} from "../rules/stage/index.ts";
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

// The node-art layout and provenance path shared by ordinary loading and certificate tools.
export function preparedPlan(
  context: ReturnType<typeof nodeArt> & { readonly seed: number },
  plan: ZonePlan,
): PreparedStage {
  const { birdFrame, hitboxes, seed, tilesets } = context;
  const catalogue = { archetypes: ARCHETYPES, characters: CHARACTERS };
  const layout = zoneLayout(TILE, birdFrame, catalogue, hitboxes, tilesets, new Set(), plan);
  return {
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
}

export function stageLoader(
  stage: string,
  artRoot = new URL("../../public/art/", import.meta.url),
) {
  const art = nodeArt(artRoot);
  const target = stageTarget(ZONE_MAP, stage);
  // A stage with no zone to play is refused before any seed is asked for.
  recipeKey(ZONE_MAP, target);
  let previous: { seed: number; stage: PreparedStage } | undefined;
  return (seed: number): PreparedStage => {
    if (previous?.seed === seed) {
      return previous.stage;
    }
    const { plan } = requirePlanned(planStage(STAGE_CONTEXT, { avoid: [], seed, target }));
    const stage = preparedPlan({ ...art, seed }, plan);
    previous = { seed, stage };
    return stage;
  };
}
