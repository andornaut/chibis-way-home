# Chibi's Way Home

[![Test](https://github.com/andornaut/chibis-way-home/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/chibis-way-home/actions/workflows/test.yml)

Help Chibi get home after Fert, his former best friend, mails him far away. A pixel-art platformer for landscape phone browsers and desktop. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

## Docs

The folder READMEs describe the current design and implementation:

- [art/](art/README.md): pipeline and tooling, with the [visual style guide](art/style-guide.md)
- [gameplay/](gameplay/README.md): gameplay scope, tuning and playtesting, with links to [current rules](gameplay/design.md), [undecided ideas](gameplay/ideas.md) and [later work](gameplay/next.md)
- [src/](src/README.md): stack, architecture and save data

## Playing

The [gameplay design](gameplay/design.md) holds the rules, and the [gameplay README](gameplay/README.md) the timing targets.

## Developing

Requires Docker and Make. The image uses Node 24.21.0 from `.nvmrc` and installs the exact npm lockfile. Host Node and npm are needed only for the native development tools below.

| Command                                          | Does                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `make check`                                     | Run lint, test and build in isolated copies, without exporting generated files                      |
| `make check-info`                                | Print the version 1 JSON check contract without starting Docker                                     |
| `make lint`                                      | Check Prettier, ESLint and Markdownlint                                                             |
| `make test`                                      | Type-check, run Vitest with four workers and verify certified chunk lists with the 20-second sample |
| `make build`                                     | Build with Vite, check art reproduction and export `dist/`                                          |
| `make test TEST_ARGS='src/rules/bird.test.ts'`   | Select Vitest cases while retaining type and certified-list checks                                  |
| `make exec COMMAND='node art/tools/ui.ts build'` | Run an explicit command with the checkout writable                                                  |

`npm run check`, `npm test`, `npm run lint` and `npm run build` are Make aliases. Use `TEST_ARGS` for focused tests. Each check category admits work only when the one-minute load is below 20, with four CPUs per container. The [shared launcher](https://github.com/andornaut/ai-maintainer/blob/6a2d882bf5a8200b97319afd8076e8f00c9707ee/tests/container/run) owns source snapshots, isolation and artifact export; the project dispatcher invokes tools directly without nested Make or Docker calls.

Native tools remain available after `npm ci`: `npm run dev`, `npm run format`, `npm run pairs -- --help`, `npm run preview`, `npm run reaches`, `npm run simulate -- --help` and `npm run test:game-kit`. Runtime documentation is in [src/README.md](src/README.md).

WORKAROUND: Parent-scoped development overrides pin [KaTeX](https://github.com/advisories/GHSA-238p-pmpm-9mq7) `0.18.2`, [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) `11.0.3` and [re2js](https://github.com/advisories/GHSA-gg6h-894w-4m9c) `2.8.7`. ESLint loads the cycle and restricted-paths rules and the resolver through exported plugin subpaths because the full plugin imports an unused rule requiring the removed minimatch `makeRe` API. Keep cycle detection enabled. Remove each override when its parent range supports the patched version; restore the full plugin import when it supports minimatch 11.

The site's HTML pages are in `pages/`, each at its URL's path (`pages/index.html` is `/`, the home page, and `pages/play/index.html` is `/play/`, the game).

## Deploying

[delivery-kit](https://github.com/andornaut/delivery-kit) ships local `main` on the schedule in [`delivery-kit.json`](delivery-kit.json). Each departure runs the gate steps that file lists (type check, lint, tests, build, a certified chunk-list verification sample and the art build check) on the `main` HEAD in an isolated container, pushes that exact commit, waits for its CI and then deploys the gated build with Wrangler to the account pinned by `account_id` in [`wrangler.jsonc`](wrangler.jsonc). Pushes and deployments are not made by hand.

The `routes` entry in `wrangler.jsonc` serves the custom domain.
