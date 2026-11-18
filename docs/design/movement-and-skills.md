# Movement and skills

Stages are built on 12 px tiles to Chibi's fixed reaches: a short press rises 3 tiles, a full jump
6, and a running jump with flutter crosses a 17-tile gap ([grid](../../gameplay/design.md#grid)). He
walks and brakes smoothly, jumps with one uninterrupted decelerating ascent, flutters on every fall,
and has coyote time and jump buffering ([Chibi](../../gameplay/design.md#chibi)). Gift rooms
permanently grant Dash, Double jump and Speedy; at most one skill is selected and only its effect
applies. No grant selects its skill; each new grant queues a tip to tap or click the skill to
enable it, tapping another owned skill switches to it, and tapping the selected skill turns it off. Ordinary required routes never need a skill, and there is no life
counter.

Reference: [Chibi](../../gameplay/design.md#chibi).

## Work items

| ID       | Title                                                     | Link                               |
| -------- | --------------------------------------------------------- | ---------------------------------- |
| cwh-0029 | Tune Chibi's movement to the grid reaches                 | [cwh-0029.md](../work/cwh-0029.md) |
| cwh-0046 | Add Dash, Double jump and Speedy as gifted skills         | [cwh-0046.md](../work/cwh-0046.md) |
| cwh-0060 | Grant skills unselected and tip the player to enable them | [cwh-0060.md](../work/cwh-0060.md) |
| cwh-0070 | Auto-select the first gifted skill                        | [cwh-0070.md](../work/cwh-0070.md) |
| cwh-0250 | Grant every skill unselected, including the first gift    | [cwh-0250.md](../work/cwh-0250.md) |
| cwh-0252 | Turn the selected power-up off with a tap                 | [cwh-0252.md](../work/cwh-0252.md) |
