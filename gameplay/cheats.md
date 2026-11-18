# Cheats

The [shared saves and cheats policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#saves-and-cheats) applies. Approved by the user on 2026-11-18.

## Entry and modal

- **Entry:** in a browser tab only, Settings shows Open Cheats beside its Back button. Availability is checked with the shared app-window check when Cheats opens and again before every action; an installed app window shows no entry and refuses every action. There is no other entry.
- **Modal:** the Cheats card uses the Large width family. Its body scrolls rather than pages, and Close is its bottom primary action. Run-only comes first, then Save-changing; a group with no actions is hidden.

## Run-only

Run-only cheats last for this browser session and never change the save, progress, statistics or achievements.

- **Invulnerability (contact hazards only):** red hazards and boss contact do not kill Chibi; falling out of the world still uses its safety fallback.
- **Enable a power-up:** each of Dash, Double jump and Speedy can be made selectable for the session. An enabled power-up never selects itself and never becomes owned.
- **Load stage:** enters any catalogued stage, chosen by zone and stage, without unlocking or clearing it.
- **FPS counter:** Off by default. On shows frames per second in the bottom-right corner of the device viewport, inset from the safe area and drawn above everything, letterbox bars included.

## Save-changing

Save-changing actions write the save. None grants or counts toward an achievement, adds statistics or marks a stage cleared. Each reports saved, unchanged, blocked, invalid and unavailable outcomes distinctly; after a partial write it says that some changes were saved, names the saved records and offers retry.

- **Unlock all zones:** every zone and stage becomes available on the map. Nothing is marked cleared, and no attempt, time or death is recorded.
- **Unlock all power-ups:** grants Dash, Double jump and Speedy to the save with ordinary grant semantics: no grant selects itself, any current selection stays and repeated grants do not stack. Each newly owned power-up shows its tip once a zone plays.
- **Show tips again:** clears the saved seen-tips record, so every first-time tip, including each power-up's, can show again.
- **Reset save:** last in the group, after a confirmation card. It resets the save entirely: progress, statistics, achievements, seen tips and every cheat grant. Device settings outside the save stay.
