import { resolve } from "node:path";

import type { PluginOption } from "vite";
import { expect, it } from "vitest";

import configPromise from "../../vite.config";

// Flatten plugin groups exactly in their declared order, without running build hooks.
async function pluginNames(plugins: PluginOption[]): Promise<string[]> {
  return (
    await Promise.all(
      plugins.map(async (plugin) => {
        const resolved = await plugin;
        return Array.isArray(resolved) ? pluginNames(resolved) : resolved ? [resolved.name] : [];
      }),
    )
  ).flat();
}

it("retains the game's ordered HTML, loading, atlas, offline and security pipeline", async () => {
  const config = await configPromise;
  expect(await pluginNames(config.plugins ?? [])).toEqual([
    "home-page-copy",
    "game-loading-indicator",
    "bird-atlas",
    "game-kit-phaser-build",
    "game-kit-hashed-icons",
    "chibis-way-home-precache-art",
    "game-kit-precache",
    "game-kit-security-headers",
  ]);
});

it("passes Duck's page entries, preview host and existing limits to the shared config", async () => {
  const config = await configPromise;
  const repoRoot = resolve(import.meta.dirname, "../..");
  expect(config.build?.rolldownOptions?.input).toEqual({
    main: resolve(repoRoot, "pages/index.html"),
    play: resolve(repoRoot, "pages/play/index.html"),
  });
  expect([config.preview?.allowedHosts, config.server?.allowedHosts]).toEqual([
    ["duck-preview"],
    ["duck-preview"],
  ]);
  expect(config.build?.chunkSizeWarningLimit).toBe(1100);
  expect(config.test?.testTimeout).toBe(5_000);
  expect(config.test?.maxWorkers).toBe(4);
});

it("discovers only game-owned tests while retaining the resolved Node test options", async () => {
  const config = await configPromise;
  expect(config.test?.include).toEqual(["src/**/*.test.ts"]);
  expect(config.test).toMatchObject({
    environment: "node",
    root: resolve(import.meta.dirname, "../.."),
    testTimeout: 5_000,
  });
});
