# Tooling

Make runs the check recipes in `tests/container/check` inside the custom dependency image CI also
uses, and the npm check scripts call the same recipes in the current environment. Containers start
only while the one-minute load is below 20 and are capped at four CPUs and 8 GiB. The `Test`
workflow runs `Test` and `Lint` jobs through Make; `AI attributions` is a separate required check.
Vite builds `pages/` and `public/` with a reduced WebGL-only Phaser bundle, content-hashed lossless
WebP atlas pages and per-page security headers into `dist/`, the only directory Wrangler deploys;
`docs/` is never served or packaged. delivery-kit ships local `main` hourly at :20
America/Toronto: it gates the exact HEAD in an isolated container, pushes it, waits for CI and
deploys. game-kit, art-kit and delivery-kit are pinned releases. Browser developer controls are
temporary and run-only.

Reference: [developing](../../README.md#developing), [deploying](../../README.md#deploying),
[assets and build](../../src/README.md#assets-and-build), [dev tools](../../src/README.md#dev-tools).

## Work items

| ID       | Title                                                                                         | Link                               |
| -------- | --------------------------------------------------------------------------------------------- | ---------------------------------- |
| cwh-0001 | Serve the site as static pages with per-page security headers                                 | [cwh-0001.md](../work/cwh-0001.md) |
| cwh-0006 | Bundle a reduced WebGL-only Phaser build                                                      | [cwh-0006.md](../work/cwh-0006.md) |
| cwh-0007 | Pack art into content-hashed lossless WebP atlas pages                                        | [cwh-0007.md](../work/cwh-0007.md) |
| cwh-0010 | Add browser developer controls with run-only cheats                                           | [cwh-0010.md](../work/cwh-0010.md) |
| cwh-0011 | Consume the shared kits as pinned published releases                                          | [cwh-0011.md](../work/cwh-0011.md) |
| cwh-0012 | Run checks in isolated, load-admitted containers                                              | [cwh-0012.md](../work/cwh-0012.md) |
| cwh-0015 | Ship local main through delivery-kit departures                                               | [cwh-0015.md](../work/cwh-0015.md) |
| cwh-0021 | Pin delivery-kit 4.6.1                                                                        | [cwh-0021.md](../work/cwh-0021.md) |
| cwh-0026 | Run only lint and attribution checks for docs-only changes                                    | [cwh-0026.md](../work/cwh-0026.md) |
| cwh-0027 | Adopt design and work files                                                                   | [cwh-0027.md](../work/cwh-0027.md) |
| cwh-0254 | Release landed and superseded Tech worktrees and branches                                     | [cwh-0254.md](../work/cwh-0254.md) |
| cwh-0259 | Keep non-player copies out of the deployed build                                              | [cwh-0259.md](../work/cwh-0259.md) |
| cwh-0260 | Strip verification hashes from the runtime layouts and ship the palette and art manifest once | [cwh-0260.md](../work/cwh-0260.md) |
