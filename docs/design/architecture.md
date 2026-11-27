# Architecture

Typed data selects entity profiles, traits and tuning. ESLint enforces component layering. Phaser
stays at the scene boundary. Bosses take one perception snapshot per object per tick, decide from
seeded streams and act through registered abilities. Behaviour refactors preserve recorded traces.
Shared kits own reusable mechanisms.

Reference: [architecture](../../src/README.md#architecture),
[source layout](../../src/README.md#source-layout), [game data](../../src/README.md#game-data).

## Work items

| ID       | Title                                                         | Link                               |
| -------- | ------------------------------------------------------------- | ---------------------------------- |
| cwh-0013 | Run boss behaviour as perceive, decide and act                | [cwh-0013.md](../work/cwh-0013.md) |
| cwh-0014 | Layer the source into components behind a Phaser boundary     | [cwh-0014.md](../work/cwh-0014.md) |
| cwh-0270 | Keep analytics out of the playable game                       | [cwh-0270.md](../work/cwh-0270.md) |
| cwh-0301 | Plan each stage through one pure entry point                  | [cwh-0301.md](../work/cwh-0301.md) |
| cwh-0302 | Step each boss encounter through one pure entry point         | [cwh-0302.md](../work/cwh-0302.md) |
| cwh-0307 | Pin procedural systems by properties and one acceptance batch | [cwh-0307.md](../work/cwh-0307.md) |
| cwh-0308 | Hand the encounter step its remaining hidden inputs           | [cwh-0308.md](../work/cwh-0308.md) |
| cwh-0310 | Layer the source behind an import check                       | [cwh-0310.md](../work/cwh-0310.md) |
| cwh-0315 | Close the procedural systems policy gaps                      | [cwh-0315.md](../work/cwh-0315.md) |
| cwh-0323 | Measure and improve Chibi performance                         | [cwh-0323.md](../work/cwh-0323.md) |
| cwh-0336 | Reuse hazard bounds for equivalent search horizons            | [cwh-0336.md](../work/cwh-0336.md) |
| cwh-0338 | Reduce active-play frame interval p99 by ten percent          | [cwh-0338.md](../work/cwh-0338.md) |
