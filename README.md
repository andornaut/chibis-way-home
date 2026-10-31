# Chibi's Way Home

[![Test](https://github.com/andornaut/duck-platformer/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/duck-platformer/actions/workflows/test.yml)

Help Chibi get home after Furt, his former best friend, mails him far away. A pixel-art platformer for landscape phone browsers and desktop. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

## Docs

Each folder's README is its plan, with what's left for the first build:

- [art/](art/README.md): art rules, assets and pipeline
- [src/](src/README.md): stack and architecture

## Playing

Reopening the app shows the start screen, with Continue and Restart when progress
is saved. Choosing Continue shows Chibi on the map without a stage chooser. Only pressing Continue on the
map opens the selected zone's stage cards. Entering a stage from the map starts
a fresh run. Death's Try again restarts the same stage directly in the same run;
pause and Resume preserve the active position and run.

Walking left from any stage entrance returns to the map. Apartment stages use
the first section's left edge after backtracking through earlier sections.
Each zone has three stages, targeting an unmeasured three-minute successful clear
each. Completing stage one or two enters the next stage directly through its
cutscene. Stage one has live foreshadowing but no physical antagonist; stage two
and three each have two physical encounters. Stage three shows the outgoing
exchange before returning to the map, or the final celebration.

## Developing

Requires Node 24 (`.nvmrc`).

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

# Print the bird's measured reaches beside gameplay's targets
npm run reaches

# Build to dist/
npm run build

# Build, then serve it through wrangler dev
npm run preview

# Remove build and Wrangler state
npm run clean
```

## Deploying

Releases use the scheduled integration queue at :10, :30 and :50 each hour
(America/Toronto). Each nonempty batch runs the type check, lint, tests and build
in an isolated container. A failed check stops the release without automatic
test retries. After a passing gate, the release process pushes the exact commit
and deploys its gated assets with Wrangler to the account pinned by `account_id`
in `wrangler.jsonc`. GitHub CI and deployment must both succeed before the release
is complete. Manual pushes and deployments are not part of this workflow.

To serve a custom domain, add a `routes` entry to `wrangler.jsonc`.
