# Development reference

[Reference index](README.md) · [Development guide](../guides/development.md)

Run commands from the repository root.

## Commands

Native development commands use Node 24.22.2 from `.nvmrc`, dependencies installed with `npm ci` and ShellCheck 0.11.0 on `PATH`. Make runs the project recipes in `tests/container/check` inside the custom dependency image used by CI. The check npm scripts call the same recipes directly in the current environment, so they also run inside a check container or the delivery gate.

| Command                                     | Does                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `make check`                                | Run the lint, test and build categories in isolated containers, without exporting generated files       |
| `make lint`                                 | Type-check, then check ShellCheck 0.11.0, Prettier, ESLint, the source layers and Markdownlint          |
| `make test`                                 | Run Vitest with four workers, then verify certified lists with the 20-second sample                     |
| `make build`                                | Build with Vite and check art reproduction, then replace the ignored host `dist/`                       |
| `make acceptance`                           | Check each admitted boss arena and connector route against its acceptance targets                       |
| `npm run check`                             | Run the lint, test and build recipes in the current environment                                         |
| `npm run typecheck`                         | Type-check with TypeScript                                                                              |
| `npm run lint`                              | Check ShellCheck 0.11.0, Prettier, ESLint, the source layers and Markdownlint                           |
| `npm test`                                  | Run Vitest with four workers, then verify certified lists; `npm test -- <arguments>` forwards to Vitest |
| `npm run build`                             | Build with Vite                                                                                         |
| `npm run pairs -- verify --sample-ms 20000` | Verify certified chunk lists with the 20-second sample                                                  |
| `node art/tools/build.ts --check`           | Check art reproduction                                                                                  |

## Containers

Each isolated invocation starts only while the one-minute load is below 20. Containers are capped at four CPUs and 4 GiB of memory and run as UID 19001. `TEST_ARGS` focuses `make test` (for example `make test TEST_ARGS=src/rules`), and `CHECK_NETWORK_LINT=bridge` gives `make lint` network access. CI uses Make because this project builds a custom Docker image. npm scripts never delegate to Make.

The custom image (`tests/container/Dockerfile`) has two stages. The `toolchain` stage pins its `node` and ShellCheck base images by digest, takes `NODE_VERSION` from `.nvmrc` through the Makefile, fails to build when the base image holds a different Node version and holds no project file, so dependency changes leave its image ID unchanged. The `check` stage, which Make builds, adds the lockfile's dependencies in `/opt/check/node_modules` for `tests/container/check` to copy into a work copy without `node_modules`. Moving to another Node release changes `.nvmrc` and the digest together.

## Native tools

Native tools also include `npm run dev`, `npm run format`, `npm run preview`, `npm run reaches`, `npm run simulate -- --help` and `npm run test:game-kit` (the game-kit wiring tests that game-kit's release proof runs after `npm run typecheck`). Runtime documentation is in [source reference](../../src/README.md).

## Dependency workarounds

WORKAROUND: The `markdownlint-cli2@0.24.0` subtree pins [KaTeX](https://github.com/advisories/GHSA-238p-pmpm-9mq7) `0.19.1` and [markdownlint](https://github.com/advisories/GHSA-gg6h-894w-4m9c) `0.42.1`. Parent-scoped [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) overrides remain at `11.0.3`. A global override holds [markdown-it](https://github.com/advisories?query=markdown-it) at `15.0.3`, its first release past the open advisories, so no dependent resolves an earlier release. Remove each override when its upstream dependency range supports the fixed version. ESLint loads the cycle and restricted-paths rules and the resolver through exported plugin subpaths because the full plugin imports an unused rule requiring the removed minimatch `makeRe` API. Keep cycle detection enabled; restore the full plugin import when it supports minimatch 11.

## Site pages

The site's HTML pages are in `pages/`, each at its URL's path (`pages/index.html` is `/`, the home page, and `pages/play/index.html` is `/play/`, the game).
