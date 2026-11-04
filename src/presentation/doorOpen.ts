// What the zone shows once she has used a door, ms after the Use: the door's open tag playing,
// play held still, for as long as the tag runs (openMs), then its room. A door whose art has no
// open tag (openMs undefined) shows its room at once.
export function doorPhase(openMs: number | undefined, sinceMs: number): "opening" | "room" {
  return openMs !== undefined && sinceMs < openMs ? "opening" : "room";
}
