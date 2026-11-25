# Tooling

Make and CI use the isolated recipes in `tests/container/check`. Local checks start below
one-minute load 20, with at most four CPUs and 4 GiB. Vite builds into `dist/`. The scheduled
Delivery Kit runner gates, pushes and deploys reviewed main. Shared kits are pinned releases.

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
| cwh-0280 | Pin Chibi to Delivery Kit 8.1.0                                                               | [cwh-0280.md](../work/cwh-0280.md) |
| cwh-0281 | Adopt Art Kit 0.33.0 in Chibi                                                                 | [cwh-0281.md](../work/cwh-0281.md) |
| cwh-0283 | Adopt Game Kit 0.64.0 in Chibi                                                                | [cwh-0283.md](../work/cwh-0283.md) |
| cwh-0290 | Adopt Game Kit 0.65.0 in Chibi                                                                | [cwh-0290.md](../work/cwh-0290.md) |
| cwh-0296 | Pack the Start background into shared art                                                     | [cwh-0296.md](../work/cwh-0296.md) |
| cwh-0297 | Adopt Game Kit 0.71 with archive-first startup                                                | [cwh-0297.md](../work/cwh-0297.md) |
| cwh-0300 | Adopt Game Kit 0.72                                                                           | [cwh-0300.md](../work/cwh-0300.md) |
| cwh-0304 | Adopt Game Kit 0.73 with compressed group archives                                            | [cwh-0304.md](../work/cwh-0304.md) |
