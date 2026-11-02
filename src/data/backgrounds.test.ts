import { describe, expect, it } from "vitest";

import { BACKGROUND_SECTIONS } from "./backgrounds";
import { THEMES } from "./chunks";
import { ZONE_MAP } from "./map";
import { RECIPES } from "./zones";

describe("background catalogue", () => {
  it("binds continuous outdoor sections without replacing indoor wall and window authoring", () => {
    const themes = new Set(
      Object.values(RECIPES).flatMap((recipe) =>
        "sections" in recipe ? recipe.sections.map((section) => section.theme) : [recipe.theme],
      ),
    );
    for (const id of themes) {
      if (id === "park") {
        continue;
      }
      const theme = THEMES[id]!;
      if (id.startsWith("apartment-")) {
        expect(theme.background, id).toBeUndefined();
        expect(theme.bindings.wall, id).toBeDefined();
        continue;
      }
      expect(theme.background?.weather, id).toHaveLength(1);
      expect(theme.background?.sections.length, id).toBeGreaterThan(1);
      for (const sectionId of theme.background!.sections) {
        const section = BACKGROUND_SECTIONS[sectionId]!;
        expect(section, sectionId).toBeDefined();
        expect(section.cols).toBeGreaterThan(0);
        for (const layer of [...theme.background!.weather, ...section.backdrops]) {
          expect(theme.bindings[layer.role!], `${id}:${layer.role}`).toBeDefined();
        }
      }
    }
  });

  it("keeps one sky treatment per outdoor zone while retaining stage-bound middle art", () => {
    for (const destination of ZONE_MAP.destinations.filter(({ id }) => id !== "apartment")) {
      const skies = destination.stages.map((id) => {
        const recipe = RECIPES[id]!;
        if ("sections" in recipe) {
          throw new Error("Outdoor stages are continuous");
        }
        const theme = THEMES[recipe.theme]!;
        return theme.background!.weather.map((layer) => {
          const binding = theme.bindings[layer.role!]!;
          return binding.skin?.art ?? binding.character;
        });
      });
      expect(skies.every((sky) => JSON.stringify(sky) === JSON.stringify(skies[0]))).toBe(true);
    }
    for (const [id, art] of [
      ["warehouse-district", "warehouse-mid"],
      ["loading-yards", "warehouse-mid"],
      ["freight-terminal", "freight-mid"],
    ]) {
      expect(THEMES[id!]!.bindings["mid-background"]!.skin?.art).toBe(art);
    }
  });

  it("preserves the Woodland species bindings independently of terrain chunk selection", () => {
    for (const id of ["forest-paths", "deep-woods", "ravine"]) {
      const theme = THEMES[id]!;
      for (const sectionId of theme.background!.sections) {
        expect(BACKGROUND_SECTIONS[sectionId]!.backdrops.map((layer) => layer.role)).toEqual([
          "woodland-far",
          "woodland-mid",
        ]);
      }
    }
  });
});
