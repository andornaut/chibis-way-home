// Node-only asset loading stays outside the pure rollout and the frontend dependency graph.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { ARCHETYPES } from "../data/archetypes";
import { BIRD } from "../data/bird";
import { CHARACTERS } from "../data/characters";
import { ZONE_MAP } from "../data/map";
import { TILE } from "../data/screen";
import { zoneLayout } from "../rules/tiles";
import { zonePlanFor } from "../rules/zonePlans";
import { artHitboxes, type ArtManifest, sheetFrameSize } from "../view/aseprite";
import type { Tileset } from "../view/tiles";
import { type PreparedStage, prepareStage } from "./simulate";

export function stageLoader(
  stage: string,
  artRoot = new URL("../../public/art/", import.meta.url),
) {
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
  const hitboxes = artHitboxes(frame, manifest);
  const birdFrame = frame("bird");
  const tilesets = Object.fromEntries(
    manifest.tilesets.map(({ json, key }) => [key, read<Tileset>(json)]),
  );
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
