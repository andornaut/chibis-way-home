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

Run checks, tests and builds inside an isolated Node 24.21.0 container as the dedicated uid 19001 with the checkout's group (`--user 19001:19001 --group-add "$(stat -c %g .)" -e HOME=/tmp`), which owns nothing on the host. Mount every host path read-only and write outputs and caches only to container paths, tmpfs or named volumes.

Checks run on the upstream `node:24.21.0` image. Art builds that export through Aseprite use `chibi-check:node24.21.0-aseprite1.2.30`, built on `node:24.21.0` from a licensed `Aseprite_1.2.30-1_amd64.deb` kept in the sibling `game-dev` checkout's `var/vendor/aseprite/`, outside version control: `docker build -f scripts/check-aseprite.Dockerfile --build-context aseprite-deb=../game-dev/var/vendor/aseprite -t chibi-check:node24.21.0-aseprite1.2.30 scripts`.

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

Tech owns implementation, integration and release approval. Each handoff to the
monitor includes the reviewed exact branch, commit SHA, base, approval and checks
completed or deferred. The monitor owns queue admission and mutation after Tech
approval, scheduled gate and CI/deployment tracking, retries, reporting and
operational resource accounting. Implementation fixes return to Tech for review
and approval.

Releases use the existing scheduled integration queue at :10 each hour
(America/Toronto). Each nonempty batch runs the type check, lint, tests and build
in an isolated container. A failed check stops the release without automatic
test retries. After a passing gate, the existing runner pushes the exact commit
and deploys its gated assets with Wrangler to the account pinned by `account_id`
in `wrangler.jsonc`. GitHub CI and deployment must both succeed before the release
is complete. Scheduled deployment retries reuse the exact gated assets. Manual
pushes and deployments are not part of this workflow.

The shared monitor checks both active games at :20 and :50 each hour
(America/Toronto); Archie releases remain at :00 and Chibi releases at :10.
`delivery-kit` owns reusable delivery source and publication; art and game kits
retain their own source.

To serve a custom domain, add a `routes` entry to `wrangler.jsonc`.
