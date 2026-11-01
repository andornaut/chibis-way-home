import { existsSync } from "node:fs";

import { expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { ZONE_MAP } from "./map";
import { STAGE_PREVIEWS } from "./stagePreviews";
import { RECIPES, ZONES } from "./zones";

it("registers an existing PNG for every built catalogue stage preview", () => {
  const plans = new Set([...Object.keys(RECIPES), ...Object.keys(ZONES)]);
  const previews = ZONE_MAP.destinations
    .flatMap(({ stages }) => stages)
    .filter((stage) =>
      ZONE_MAP.nodes.some(
        (node) =>
          node.id === stage &&
          node.kind === "zone" &&
          node.zone !== undefined &&
          plans.has(node.zone),
      ),
    )
    .map((stage) => {
      const key = STAGE_PREVIEWS[stage];
      return { image: manifest.images.find((image) => image.key === key), key, stage };
    });
  expect({
    hasBuiltStages: previews.length > 0,
    missingMappings: previews.filter(({ key }) => key === undefined).map(({ stage }) => stage),
    missingPngs: previews.flatMap(({ image, stage }) =>
      image && !existsSync(new URL(`../../public/art/${image.png}`, import.meta.url))
        ? [{ png: image.png, stage }]
        : [],
    ),
    unregistered: previews
      .filter(({ image, key }) => key !== undefined && image === undefined)
      .map(({ key, stage }) => ({ key, stage })),
  }).toEqual({ hasBuiltStages: true, missingMappings: [], missingPngs: [], unregistered: [] });
});
