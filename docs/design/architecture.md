# Architecture

Code defines mechanisms; typed data in `src/data/` selects entity profiles, traits and tuning
without dispatching on entity IDs. Each `src/` folder is a component that imports only the
components below it, enforced by ESLint, and only `src/scenes/` and `src/main.ts` import Phaser,
so rules, layout and data unit-test without a renderer. Boss behaviour runs perceive, decide, act:
one perception snapshot per object per tick, decisions from an explicit seeded stream factory and
ability modules in an explicit table. `src/rules` and `src/ai` never use `Math.random`, `Date` or
`performance`, and behaviour refactors keep the recorded trace hashes identical. Game-independent
code belongs in the pinned shared kits.

Reference: [architecture](../../src/README.md#architecture),
[source layout](../../src/README.md#source-layout), [game data](../../src/README.md#game-data).

## Work items

| ID       | Title                                                     | Link                               |
| -------- | --------------------------------------------------------- | ---------------------------------- |
| cwh-0013 | Run boss behaviour as perceive, decide and act            | [cwh-0013.md](../work/cwh-0013.md) |
| cwh-0014 | Layer the source into components behind a Phaser boundary | [cwh-0014.md](../work/cwh-0014.md) |
| cwh-0270 | Keep analytics out of the playable game                   | [cwh-0270.md](../work/cwh-0270.md) |
