# Chibi's Way Home

[![Test](https://github.com/andornaut/chibis-way-home/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/chibis-way-home/actions/workflows/test.yml)

Help Chibi get home after Fert, his former best friend, mails him far away. A pixel-art platformer for landscape phone browsers and desktop. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

## Docs

The folder READMEs describe the current design and implementation:

- [art/](art/README.md): pipeline and tooling, with the [visual style guide](art/style-guide.md)
- [gameplay/](gameplay/README.md): gameplay scope, tuning and playtesting, with links to [current rules](gameplay/design.md), [undecided ideas](gameplay/ideas.md) and [later work](gameplay/next.md)
- [src/](src/README.md): stack, architecture and save data

## Playing

Reopening the app shows the start screen, with Continue and Restart when progress
is saved. Choosing Continue shows Chibi on the map without a stage chooser. Only pressing Continue on the
map opens the selected zone's stage cards. Entering a stage from the map starts
a fresh run. Death's Try again restarts the same stage directly in the same run;
pause and Resume preserve the active position and run.

Walking left from a stage's entrance returns to the map; Apartment floors use
their lower entrance edge. The six zones contain twenty-one stages: three in each
of the first five zones and six standalone Apartment floors. Target successful
active play is about 60 seconds on ordinary required routes without any powerup
active, with Apartment retaining about 90 seconds per floor. These are tuning
targets, not hard timers or fully calibrated times for every stage.

The first five zones have a paused cinematic introduction in stage one, two
randomized middle hostile encounters in stage two and three in stage three.
Apartment has no physical Fert in Lobby, Restaurant or Pool; Spa has the cinematic
introduction only, Residential floors has two hostile encounters and Penthouse
has three. Cinematic introductions are outside hostile quotas and release play
when the antagonist starts leaving. Nonfinal clears show statistics before the
next stage; each zone's final exchange and statistics lead back to the map, except
Penthouse leads to the final celebration.

## Developing

Requires Node 24.21.0 or newer (`.nvmrc` pins 24.21.0).

Run checks, tests and builds inside an isolated `node:24.21.0` container, as the dedicated uid 19001 with the checkout's group, which owns nothing on the host. Mount host paths read-only and only with `--mount` (`-v` creates a missing source as root), keep outputs and caches inside the container and copy results out with `docker cp`. From the checkout, with `NPM_CACHE` naming a populated npm cache the checkout's group can read:

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

Replace the last line with any command below, including the art generators (`node art/tools/<tool>.ts <command>`), which need no extra tools.

WORKAROUND: Parent-scoped development overrides pin [KaTeX](https://github.com/advisories/GHSA-238p-pmpm-9mq7) `0.18.2`, [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) `11.0.3` and [re2js](https://github.com/advisories/GHSA-gg6h-894w-4m9c) `2.8.7`. ESLint loads the cycle and restricted-paths rules and the resolver through exported plugin subpaths because the full plugin imports an unused rule requiring the removed minimatch `makeRe` API. Keep cycle detection enabled. Remove each override when its parent range supports the patched version; restore the full plugin import when it supports minimatch 11.

The site's HTML pages are in `pages/`, each at its URL's path (`pages/index.html` is `/`, the home page, and `pages/play/index.html` is `/play/`, the game).

```bash
npm install

# Dev server
npm run dev

# Type check with tsc
npm run check

# Prettier check, ESLint and markdownlint
npm run lint

# Rewrite files with Prettier and apply ESLint fixes
npm run format

# Run the unit tests
npm test

# Print the bird's measured reaches beside gameplay's targets; exits 1 when one is off
npm run reaches

# Build to dist/
npm run build

# Build, then serve it through wrangler dev
npm run preview

# Remove build and Wrangler state
npm run clean
```

## Deploying

[delivery-kit](https://github.com/andornaut/delivery-kit) ships local `main` on the schedule in [`delivery-kit.json`](delivery-kit.json). Each departure runs the type check, lint, tests and build on the `main` HEAD in an isolated container, pushes that exact commit, waits for its CI and then deploys the gated build with Wrangler to the account pinned by `account_id` in [`wrangler.jsonc`](wrangler.jsonc). Pushes and deployments are not made by hand.

The `routes` entry in `wrangler.jsonc` serves the custom domain.
