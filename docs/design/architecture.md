# Architecture

Typed data selects entity profiles, traits and tuning. ESLint enforces component layering. Phaser
stays at the scene boundary. Bosses take one perception snapshot per object per tick, decide from
seeded streams and act through registered abilities. Behaviour refactors preserve recorded traces.
Shared kits own reusable mechanisms.

Reference: [architecture](../../src/README.md#architecture),
[source layout](../../src/README.md#source-layout), [game data](../../src/README.md#game-data).

## Work items

| ID       | Title                                                     | Link                               |
| -------- | --------------------------------------------------------- | ---------------------------------- |
| cwh-0013 | Run boss behaviour as perceive, decide and act            | [cwh-0013.md](../work/cwh-0013.md) |
| cwh-0014 | Layer the source into components behind a Phaser boundary | [cwh-0014.md](../work/cwh-0014.md) |
| cwh-0270 | Keep analytics out of the playable game                   | [cwh-0270.md](../work/cwh-0270.md) |
| cwh-0301 | Plan each stage through one pure entry point              | [cwh-0301.md](../work/cwh-0301.md) |
| cwh-0302 | Step each boss encounter through one pure entry point     | [cwh-0302.md](../work/cwh-0302.md) |
