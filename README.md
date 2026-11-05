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

Requires Node 24.21.0 or newer (`.nvmrc` pins 24.21.0).

Run every command below inside an isolated `node:24.21.0` container, never on the host, as the dedicated uid 19001 with the checkout's group, which owns nothing on the host. Mount host paths read-only and only with `--mount` (`-v` creates a missing source as root), keep outputs and caches inside the container and copy results out with `docker cp`. From the checkout, with `NPM_CACHE` naming a populated npm cache the checkout's group can read:

```sh
docker run --rm --network none --cpus=4 \
  --user 19001:19001 --group-add "$(stat -c %g .)" --group-add "$(stat -c %g "$NPM_CACHE")" \
  -e HOME=/tmp \
  --mount type=bind,src="$PWD",dst=/src,readonly \
  --mount type=bind,src="$NPM_CACHE",dst=/npm-cache,readonly \
  node:24.21.0 sh -c 'mkdir /tmp/work \
    && tar -C /src --exclude=./.claude --exclude=./.worktrees --exclude=./node_modules -cf - . \
    | tar -C /tmp/work -xf - \
    && cp -r /npm-cache /tmp/npm-cache && cd /tmp/work \
    && npm ci --offline --cache /tmp/npm-cache \
    && npm run check && npm run lint && npm test -- --maxWorkers=4'
```

Replace the last line with any command in the table, or an art generator (`node art/tools/<tool>.ts <command>`), which needs no extra tools.

To fill `NPM_CACHE`, install once in a networked container and copy its cache out:

```sh
docker run --name npm-fill --cpus=4 \
  --user 19001:19001 --group-add "$(stat -c %g .)" -e HOME=/tmp \
  --mount type=bind,src="$PWD",dst=/src,readonly \
  node:24.21.0 sh -c 'cd /tmp && cp /src/package.json /src/package-lock.json . \
    && npm ci --cache /tmp/npm-cache'
docker cp npm-fill:/tmp/npm-cache "$NPM_CACHE" && docker rm npm-fill
```

Alternatively, skip the cache: start the container detached with the network, run `npm ci` in it, then `docker network disconnect bridge <container>` before running any check.

| Command                      | Does                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `npm run build`              | Build to `dist/`                                                                     |
| `npm run check`              | Type check with tsc                                                                  |
| `npm run clean`              | Remove the build and Wrangler state                                                  |
| `npm run dev`                | Dev server                                                                           |
| `npm run format`             | Rewrite files with Prettier and apply ESLint fixes                                   |
| `npm run lint`               | Prettier, ESLint and markdownlint                                                    |
| `npm run pairs -- --help`    | Certify, verify and report the certified chunk lists                                 |
| `npm run preview`            | Build, then serve it through `wrangler dev`                                          |
| `npm run reaches`            | Print the bird's measured reaches beside gameplay's targets; exits 1 when one is off |
| `npm run simulate -- --help` | Simulate runs ([src/README.md](src/README.md), Bounded simulations)                  |
| `npm test`                   | Run the unit tests                                                                   |
| `npm run test:game-kit`      | Run the game tests game-kit's release proof runs                                     |

WORKAROUND: Parent-scoped development overrides pin [KaTeX](https://github.com/advisories/GHSA-238p-pmpm-9mq7) `0.18.2`, [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) `11.0.3` and [re2js](https://github.com/advisories/GHSA-gg6h-894w-4m9c) `2.8.7`. ESLint loads the cycle and restricted-paths rules and the resolver through exported plugin subpaths because the full plugin imports an unused rule requiring the removed minimatch `makeRe` API. Keep cycle detection enabled. Remove each override when its parent range supports the patched version; restore the full plugin import when it supports minimatch 11.

The site's HTML pages are in `pages/`, each at its URL's path (`pages/index.html` is `/`, the home page, and `pages/play/index.html` is `/play/`, the game).

## Deploying

[delivery-kit](https://github.com/andornaut/delivery-kit) ships local `main` on the schedule in [`delivery-kit.json`](delivery-kit.json). Each departure runs the gate steps that file lists (type check, lint, tests, build, a `npm run pairs -- verify` sample of the certified chunk lists and the art build check) on the `main` HEAD in an isolated container, pushes that exact commit, waits for its CI and then deploys the gated build with Wrangler to the account pinned by `account_id` in [`wrangler.jsonc`](wrangler.jsonc). Pushes and deployments are not made by hand.

The `routes` entry in `wrangler.jsonc` serves the custom domain.
