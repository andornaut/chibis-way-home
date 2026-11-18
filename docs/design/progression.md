# Progression

The map shows the six V1 zones in route order; clearing a stage unlocks the next built stage,
completed stages stay replayable, and V1 has no forks ([map](../../gameplay/design.md#map)).
Progress saves completed stages and Chibi's map position, and reopening the app shows the start
screen ([runs and attempts](../../gameplay/design.md#runs-and-attempts)). A stage's start is its
only checkpoint: death plays a held sequence and a required retry card, and Try again restarts the
same run, with unlimited retries ([death and retry](../../gameplay/design.md#death-and-retry)).
Clears, retries and zone ends show the current stage's Attempts, Last time and Best time beside the
Stage, Zone and Run totals, which only confirmed Restart clears ([stage
statistics](../../gameplay/design.md#stage-statistics-and-interstitials)). Every stage has a skill
gift room behind a door ([rooms](../../gameplay/design.md#rooms)), and twenty-six achievements in
three tiers use a separate save that Restart preserves
([achievements](../../gameplay/design.md#achievements)).

Reference: [map](../../gameplay/design.md#map), [achievements](../../gameplay/design.md#achievements), [save data](../../src/README.md#save-data).

## Work items

| ID       | Title                                                             | Link                               |
| -------- | ----------------------------------------------------------------- | ---------------------------------- |
| cwh-0033 | Put optional rooms behind doors                                   | [cwh-0033.md](../work/cwh-0033.md) |
| cwh-0035 | Travel a linear map of zones with saved progress                  | [cwh-0035.md](../work/cwh-0035.md) |
| cwh-0038 | Show the death sequence and retry card                            | [cwh-0038.md](../work/cwh-0038.md) |
| cwh-0041 | Track runs, attempts and stage statistics                         | [cwh-0041.md](../work/cwh-0041.md) |
| cwh-0049 | Add the 26 achievements                                           | [cwh-0049.md](../work/cwh-0049.md) |
| cwh-0058 | Show stage progress horizontally and keep zone visit stats hidden | [cwh-0058.md](../work/cwh-0058.md) |
| cwh-0068 | Divide stage statistics from the Stage, Zone and Run totals       | [cwh-0068.md](../work/cwh-0068.md) |
