import type { FilledSlot, StageRecipe, ZoneRecipe } from "../../data/types/index.ts";
import type { GiftBinding, GiftSlotFills } from "./assemblyContext.ts";

export function validateGiftReservation(
  binding: GiftBinding | undefined,
  recipe: StageRecipe,
): void {
  if (!binding) {
    return;
  }
  const doors =
    "sections" in recipe ? recipe.sections.flatMap((section) => section.doors) : recipe.doors;
  const count = doors
    .filter(({ room }) => room === binding.reservedRoom)
    .reduce((sum, door) => sum + door.count, 0);
  if (count !== 1) {
    throw new Error("Gift binding requires exactly one reserved door");
  }
}

// The reservation has already consumed its canonical slot shuffle and capacity.
export function bindGiftSlots(
  binding: GiftBinding | undefined,
  filled: Map<FilledSlot, string>,
): void {
  if (!binding) {
    return;
  }
  for (const [slot, room] of filled) {
    if (slot.kind === "door" && room === binding.reservedRoom) {
      if (binding.room === null) {
        filled.delete(slot);
      } else {
        filled.set(slot, binding.room);
      }
    }
  }
}

export function slotFills(
  binding: GiftBinding | undefined,
  recipe: Pick<ZoneRecipe, "doors" | "events"> & Partial<Pick<ZoneRecipe, "start" | "startDoors">>,
): GiftSlotFills {
  return {
    door: recipe.doors.flatMap(({ count, room }) => Array<string>(count).fill(room)),
    event: recipe.events.flatMap(({ count, id }) => Array<string>(count).fill(id)),
    ...(binding && { giftBinding: binding }),
    ...(recipe.start !== undefined && { start: recipe.start }),
    ...(recipe.startDoors && { startDoors: recipe.startDoors }),
  };
}
