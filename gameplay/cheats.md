# Cheats

The [shared saves and cheats policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#saves-and-cheats) applies. Approved by the user on 2026-11-18.

## Entry and modal

- **Entry:** in a browser tab only, Settings shows Open Cheats in an action row at the bottom of its card. Availability is checked with the shared app-window check when Cheats opens and again before every action; an installed app window shows no entry and refuses every action. There is no other entry.
- **Modal:** the Cheats card uses the Large width family. Its scrollable body contains Cheats, then Tools. The top-right header X and the sole centred Close button in the footer both dismiss Cheats and return focus to Open Cheats in Settings.

## Cheat session

Cheats never touch the save. Using any cheat starts a cheat session: from then on nothing is saved, earned or banked, including progress, unlocks, skill grants, seen tips, achievements and statistics. Cheats chosen on the start screen apply to the session that the next Start or Continue begins. Returning to the start screen from play, reloading or closing the game ends the session, which is itself never stored, and Continue then loads the save as it was before the first cheat.

## Cheats

- **Invulnerability (contact hazards only):** red hazards and boss contact do not kill Chibi; falling out of the world still uses its safety fallback.
- **Enable a power-up:** each of Dash, Double jump and Speedy can be made selectable. An enabled power-up never selects itself.
- **Load stage:** enters any catalogued stage without reloading the page, chosen by stepping through zone and stage picker rows.
- **Unlock all power-ups:** makes Dash, Double jump and Speedy owned for the session. No power-up selects itself and any current selection stays.
- **Unlock all zones:** makes every zone and stage available on the map for the session, from the next time the map opens.

## Tools

Tools are not cheats and start no cheat session.

- **Show tips again:** clears the saved seen-tips record, so every first-time tip, including each power-up's, can show again.
- **FPS counter:** Off by default. On shows the frames per second as a number in the bottom-right corner of the device viewport, inset from the safe area and drawn above everything, letterbox bars included. It is a device setting, not part of the save.
- **Reset save:** last, after a confirmation card. It resets the save entirely (progress, statistics, achievements and seen tips), then returns to the start screen. Device settings outside the save stay.
