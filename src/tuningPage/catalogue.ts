import * as behaviours from "../data/behaviours.ts";
import { BIRD } from "../data/bird.ts";
import { CAMERA } from "../data/camera.ts";
import { CHARACTERS } from "../data/characters.ts";
import { DEATH } from "../data/death.ts";
import * as dialogues from "../data/dialogues.ts";
import { CONTACT_CUE, CONTROL_REFUSAL } from "../data/feedback.ts";
import { OPENING } from "../data/opening.ts";
import { REACH } from "../data/reach.ts";
import * as screen from "../data/screen.ts";
import { TOUCH } from "../data/touch.ts";
import { RECIPES } from "../data/zones.ts";

export const TUNING_GROUPS = {
  Behaviours: behaviours,
  Bird: BIRD,
  Camera: CAMERA,
  Characters: CHARACTERS,
  "Contact feedback": CONTACT_CUE,
  "Control refusal": CONTROL_REFUSAL,
  Death: DEATH,
  "Live barks": Object.fromEntries(
    Object.entries(dialogues).filter(([key]) => key.startsWith("BARK_")),
  ),
  Opening: OPENING,
  Reach: REACH,
  Screen: screen,
  "Stage recipes": RECIPES,
  Touch: TOUCH,
};

interface TuningRow {
  readonly group: string;
  readonly path: string;
  readonly value: string;
}

// Data is read directly; the reference page never creates an override or starts a run.
export function tuningRows(groups: Readonly<Record<string, unknown>>): readonly TuningRow[] {
  const rows: TuningRow[] = [];
  const append = (group: string, path: string, value: unknown): void => {
    if (value === null || ["boolean", "number", "string"].includes(typeof value)) {
      rows.push({ group, path, value: String(value) });
    } else if (typeof value === "object") {
      Object.entries(value).forEach(([key, entry]) =>
        append(group, path ? `${path}.${key}` : key, entry),
      );
    }
  };
  Object.entries(groups).forEach(([group, value]) => append(group, "", value));
  return rows.sort((a, b) => a.group.localeCompare(b.group) || a.path.localeCompare(b.path));
}
