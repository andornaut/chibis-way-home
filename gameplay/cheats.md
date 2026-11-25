# Cheats

The [shared saves and cheats policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#saves-and-cheats) applies.

## Entry and modal

- **Entry:** the Cheats button in Menu or Pause is the sole entry in browser tabs and installed apps. Actions require the active foreground card.
- **Modal:** the narrower card fits a single column and its footer without scrolling. The top-right X and sole centred Back button each return to the invoking Menu or Pause, restore focus to Cheats and preserve the held scenes.

## Saving

Cheats act on the real save like normal play: progress, unlocks, power-ups, seen tips, achievements and statistics from cheats and cheated runs are saved and earned as usual. A cheat chosen on the start screen applies to the next Start or Continue. Confirmed Restart returns to a new save.

A run link (`?zone=` with a stage's map node) plays that stage on its own and replays it after each clear. A clear, not a turn back, records the stage's run statistics and clear achievements like a map clear. Where the map already opens that stage, it also saves the completion and moves the map stand there; otherwise the map is unchanged. Ordinary first-time tips still work under the [tip rules](player-copy.md#dialogue).

## Controls

The controls stack in this order:

1. **Unlock all power-ups** saves ownership of Dash, Double jump and Speedy and keeps the current selection.
2. **Unlock all zones** saves every zone and stage as unlocked.
3. **Invincibility** is a switch with its visible On or Off state centred below it. It prevents deaths from contact hazards, including red hazards and bosses. Falling out of the world remains lethal. It is a device preference stored apart from progress, Off by default: it stays on across returning to the start screen, reloads and Restart until switched off.
