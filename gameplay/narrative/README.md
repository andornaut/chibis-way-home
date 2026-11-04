# Homeward journey: design notes

These notes hold the journey's connective scenes and story beats; undecided rule proposals belong in [`ideas.md`](../ideas.md). Established facts come from the [rulebook](../design.md#setting). Everything labelled **Proposal** is unapproved and unimplemented, including friendly characters, rooms, items, quests and rewards.

## Established direction

Chibi wants his home back. Fert, his former best friend and apartment-mate, mailed him away after a fight. Fert's friends try to stop Chibi as a favour to Fert. The fight's cause and the friendship's outcome remain undecided. There is no combat, no required quest gate and no human cast.

The route moves from unfamiliar surroundings to familiar places: [Blue cityscape](blue-cityscape.md), [Industrial outskirts](industrial-outskirts.md), [Countryside](countryside.md), [Woodland](woodland.md), [Home city](home-city.md), then the [Apartment building](apartment-building.md).

## Proposed connective direction

Give the journey one visual question: how close is home? Begin with an address on discarded packaging, reveal the destination skyline beyond the countryside, recognize individual streets in the home city, then frame the apartment window from inside the building. These are proposed animation beats, not new route requirements or an item Chibi must carry.

Each antagonist interprets the same favour through a distinct personality. Archie guards territory, Pebble claims airspace, Trixi makes rules, Bini wants his game uninterrupted, Kiwi watches from a good vantage point, and Fert tries to maintain control of a plan that has failed. Their exchanges need not disclose a secret or excuse Fert. Chibi becomes more specific about where he belongs without deciding whether to forgive him.

Use brief visual transitions to establish the next place. Save longer conversations for optional rooms. The ending can establish Chibi's return and claim to the apartment while leaving the relationship open; do not turn the last encounter into a boss fight or a reconciliation requirement.

## Proposed optional-content loop

Start with one Blue cityscape prototype before extending the system:

1. Show an optional item from the primary route, with its detour and return route legible.
2. Reach it through a short challenge that varies the zone's established traversal.
3. Return by a shortcut or enter an adjacent friendly room to redeem it.
4. Receive a small optional reward. The stage exit always works without it.

A generated detour must connect to the actual route and have a safe return. It must not require searching a procedural dead end, repeating a cleared stage, or backtracking through an antagonist encounter. Friendly room inhabitants are proposed conversational characters, not additional foreground hostiles. Optional routes may reconnect locally without changing V1's linear zone order.

## Ranked reward recommendations

1. **Clue or cosmetic:** begin with a visible route hint or a cosmetic token. These avoid changing calibrated movement and can test whether exploration is enjoyable.
2. **One-hit shield:** consider only after that loop works. Proposed semantics: consume immediately on the first otherwise lethal contact hazard; falls remain lethal. Contact protection must not become blanket immunity to vertical hazards. Activation, remaining contact during consumption and feedback need a separate implementation decision.
3. **Other buffs:** defer. Extra lives add little with unlimited retries. Speed or jump buffs change traversal calibration and can invalidate authored routes.

Whether items, redemptions or rewards persist across death, fresh entry or playthroughs is unresolved. These notes do not prescribe save fields, checkpoint behaviour, shield stacking or reward replenishment.

## Evaluation

Human playtesting should answer whether the detour is clearly optional, whether the shortcut prevents tedious repetition, and whether its reward is worth the interruption. Bot completion does not answer those questions. Keep the first prototype small enough to remove without affecting the primary route.
