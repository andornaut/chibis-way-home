// Why a zone's play holds still: a door opening before its room shows, or the fade out of an
// ended zone, and back in where the next zone plays in the same scene. Each run of ZoneScene
// starts with none.
export type PlayHold = "door" | "fade" | undefined;

// What a frame does with each step of play: step the rules, leave the zone once it has ended
// (cleared, or turned back into its first column), or nothing while play holds. The fade holds
// play from leaving until the map takes over, so a zone is never left twice.
export function stepAction(hold: PlayHold, ended: boolean): "hold" | "leave" | "step" {
  if (hold !== undefined) {
    return "hold";
  }
  return ended ? "leave" : "step";
}
