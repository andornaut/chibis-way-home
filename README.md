# Chibi's Way Home

[![Test](https://github.com/andornaut/chibis-way-home/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/chibis-way-home/actions/workflows/test.yml)

Help Chibi get home after Fert, his former best friend, mails him far away. A pixel-art platformer for landscape phone browsers and desktop. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

## Docs

Start with the [documentation index](docs/README.md) for design, work items and the Art, Gameplay and Source references.

## Playing

The [gameplay rules](gameplay/design.md) and [gameplay targets](gameplay/README.md) describe play.

## Developing

Use `make check` for isolated lint, tests and builds, or `make build` to produce `dist/`. See [development](docs/guides/development.md) for prerequisites, focused checks, native commands and container details.

## Deploying

The scheduled Delivery Kit runner gates, pushes and deploys local `main`. See [delivery](docs/reference/delivery.md) for the configuration and gate-image procedure.
