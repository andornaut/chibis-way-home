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

Native development commands use Node 24.22.2 from `.nvmrc`, dependencies installed with `npm ci` and ShellCheck 0.11.0 on `PATH`. npm scripts run their native tools directly on the host. Make wraps isolated checks in the custom dependency image used by CI.

| Command                                     | Does                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make check`                                | Type-check, lint, run Vitest with four workers, build, verify certified lists with the 20-second sample and check art reproduction without exporting generated files |
| `make lint`                                 | Type-check and run `npm run lint` in the custom image                                                                                                                |
| `make test`                                 | Run Vitest with four workers and verify certified lists with the 20-second sample in the custom image                                                                |
| `make build`                                | Run Vite and art reproduction checks in the custom image                                                                                                             |
| `npm run check`                             | Type-check with TypeScript                                                                                                                                           |
| `npm run lint`                              | Check ShellCheck 0.11.0, Prettier, ESLint and Markdownlint                                                                                                           |
| `npm test -- --maxWorkers=4`                | Run Vitest with four workers                                                                                                                                         |
| `npm run build`                             | Build with Vite                                                                                                                                                      |
| `npm run pairs -- verify --sample-ms 20000` | Verify certified chunk lists with the 20-second sample                                                                                                               |
| `node art/tools/build.ts --check`           | Check art reproduction                                                                                                                                               |

Each isolated invocation starts only while the one-minute load is below 20. Containers are capped at four CPUs and 8 GiB of memory and run as UID 19001. `TEST_ARGS` focuses `make test` (for example `make test TEST_ARGS=src/rules`), and `CHECK_NETWORK_LINT=bridge` gives `make lint` network access. CI uses Make because this project builds a custom Docker image. Host npm scripts remain native and never delegate to Make.

The custom image (`tests/container/Dockerfile`) pins its `node` and ShellCheck base images by digest, takes `NODE_VERSION` from `.nvmrc` through the Makefile and fails to build when the base image holds a different Node version. Moving to another Node release changes `.nvmrc` and the digest together.

Native tools also include `npm run dev`, `npm run format`, `npm run preview`, `npm run reaches`, `npm run simulate -- --help` and `npm run test:game-kit`. Runtime documentation is in [src/README.md](src/README.md).

WORKAROUND: The `markdownlint-cli2@0.24.0` subtree pins [KaTeX](https://github.com/advisories/GHSA-238p-pmpm-9mq7) `0.19.1` and [markdownlint](https://github.com/advisories/GHSA-gg6h-894w-4m9c) `0.42.1`. Parent-scoped [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) overrides remain at `11.0.3`. Remove each override when its upstream dependency range supports the fixed version. ESLint loads the cycle and restricted-paths rules and the resolver through exported plugin subpaths because the full plugin imports an unused rule requiring the removed minimatch `makeRe` API. Keep cycle detection enabled; restore the full plugin import when it supports minimatch 11.

The site's HTML pages are in `pages/`, each at its URL's path (`pages/index.html` is `/`, the home page, and `pages/play/index.html` is `/play/`, the game).

## Deploying

[delivery-kit](https://github.com/andornaut/delivery-kit) ships local `main` on the schedule in [`delivery-kit.json`](delivery-kit.json). Each departure installs dependencies with `npm ci` and runs `tests/container/check lint`, `test` and `build` (the same categories as `make check`) on the `main` HEAD in an isolated container, pushes that exact commit, waits for its CI and then deploys the gated build with Wrangler to the account pinned by `account_id` in [`wrangler.jsonc`](wrangler.jsonc). A departure starts only while the one-minute load is below 30; otherwise it re-checks the load every minute for up to 15 minutes after its slot, then skips that slot. Pushes and deployments are not made by hand.

The gate image is the immutable local image ID in `delivery-kit.json`, built from the custom Dockerfile on the delivery host and tagged so that image pruning keeps it:

```sh
tar --create --file "${TMPDIR:-/tmp}/chibi-gate-context.tar" \
  --mode='u+rwX,go+rX' --files-from tests/container/context
tests/container/admit build-image
docker build --resource cpu-period=100000 --resource cpu-quota=400000 \
  --resource memory=8g --build-arg NODE_VERSION="$(sed 's/^v//' .nvmrc)" \
  --tag chibi-check:node24.22.2-shellcheck0.11.0 \
  --file tests/container/Dockerfile - < "${TMPDIR:-/tmp}/chibi-gate-context.tar"
docker image inspect --format '{{.Id}}' chibi-check:node24.22.2-shellcheck0.11.0
```

The printed ID must equal `gate.image`. Image IDs are content addressed and local: a rebuild after a change to a `tests/container/context` input produces a new ID, which replaces the pin in `delivery-kit.json` once that image is verified.

The `routes` entry in `wrangler.jsonc` serves the custom domain.
