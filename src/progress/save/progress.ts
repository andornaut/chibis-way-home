import type { Checked, SaveFormat, StoredObject } from "@andornaut/game-kit/save/versionedSave";

import type { SkillSelection, ZoneMap } from "../../data/types";
import { openMap } from "../map";
import { isSkillId } from "../skills";

// The player's progress: the beginning (no progress saved, the start screen offers Start), or
// the map, with the zone nodes he has completed and the zone node he stands on.
export type Progress = SkillSelection & { readonly openingSeen: boolean } & (
    | { readonly at: "beginning" }
    | {
        readonly at: "map";
        readonly completed: readonly string[];
        readonly seenZoneIntros: readonly string[];
        readonly stand: string;
      }
  );

export const BEGINNING: Progress = {
  activeSkill: null,
  at: "beginning",
  openingSeen: false,
  skills: [],
};

// The save format's version. Before the first release, a change to the format or a map node or
// zone renamed bumps it, and older saves reset to the beginning.
export const PROGRESS_VERSION = 10;

// Where he is on the map for progress: the beginning stands him on the map's start with
// nothing completed.
export function mapProgress(
  map: ZoneMap,
  progress: Progress,
): { readonly completed: readonly string[]; readonly stand: string } {
  return progress.at === "beginning"
    ? { completed: [], stand: map.start }
    : { completed: progress.completed, stand: progress.stand };
}

const isNames = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((name) => typeof name === "string");

// Why progress does not fit map and zones, or undefined when it does: each completed zone node,
// and the node he stands on, is a zone node the completed zones open (openMap), whose zone is in
// zones, named once.
function progressProblem(
  map: ZoneMap,
  zones: Readonly<Record<string, unknown>>,
  completed: readonly string[],
  stand: string,
): string | undefined {
  const done = new Set(completed);
  if (done.size !== completed.length) {
    return "the save names a completed zone twice";
  }
  const open = openMap(map, done).zones.filter((id) => {
    const zone = map.nodes.find((node) => node.id === id)?.zone;
    return zone !== undefined && zone in zones;
  });
  const closed = completed.find((id) => !open.includes(id));
  if (closed !== undefined) {
    return `the completed zone ${closed} is not open on the map`;
  }
  return open.includes(stand) ? undefined : `he stands on ${stand}, not an open zone`;
}

// The progress save's format on map and zones: a save that no longer fits them (a renamed node, a
// path not built, a zone removed) is refused, and the player starts from the beginning.
export function progressFormat(
  map: ZoneMap,
  zones: Readonly<Record<string, unknown>>,
): SaveFormat<Progress> {
  const checked = (progress: Progress): Checked<Progress> => {
    if (
      !Array.isArray(progress.skills) ||
      !progress.skills.every(isSkillId) ||
      new Set(progress.skills).size !== progress.skills.length
    ) {
      return { ok: false, reason: "the save has an invalid skill list" };
    }
    if (
      progress.activeSkill === null
        ? progress.skills.length > 0
        : !isSkillId(progress.activeSkill) || !progress.skills.includes(progress.activeSkill)
    ) {
      return { ok: false, reason: "the save has an invalid active skill" };
    }
    if (typeof progress.openingSeen !== "boolean") {
      return { ok: false, reason: "the save has no opening acknowledgement" };
    }
    if (progress.at === "beginning") {
      return { ok: true, value: progress };
    }
    const seen = progress.seenZoneIntros;
    if (
      new Set(seen).size !== seen.length ||
      seen.some((id) => !map.destinations.some((destination) => destination.id === id))
    ) {
      return { ok: false, reason: "the save names invalid zone introductions" };
    }
    const problem = progressProblem(map, zones, progress.completed, progress.stand);
    return problem === undefined ? { ok: true, value: progress } : { ok: false, reason: problem };
  };
  return {
    decode: ({
      activeSkill,
      at,
      completed,
      openingSeen,
      seenZoneIntros,
      skills,
      stand,
    }: StoredObject): Checked<Progress> => {
      if (typeof openingSeen !== "boolean") {
        return { ok: false, reason: "the save has no opening acknowledgement" };
      }
      if (!Array.isArray(skills) || !skills.every(isSkillId)) {
        return { ok: false, reason: "the save has no valid skill list" };
      }
      if (activeSkill !== null && !isSkillId(activeSkill)) {
        return { ok: false, reason: "the save has no valid active skill" };
      }
      if (at === "beginning") {
        return checked({ activeSkill, at, openingSeen, skills });
      }
      if (at !== "map") {
        return { ok: false, reason: "the save does not say where he is" };
      }
      if (!isNames(completed)) {
        return { ok: false, reason: "the save's completed zones are not a list of map nodes" };
      }
      if (typeof stand !== "string") {
        return { ok: false, reason: "the save does not say where he stands" };
      }
      if (!isNames(seenZoneIntros)) {
        return { ok: false, reason: "the save has no zone introduction list" };
      }
      return checked({ activeSkill, at, completed, openingSeen, seenZoneIntros, skills, stand });
    },
    encode: (progress: Progress): Checked<StoredObject> => {
      const valid = checked(progress);
      return valid.ok ? { ok: true, value: { ...valid.value } } : valid;
    },
    fresh: () => BEGINNING,
    migrations: {},
    version: PROGRESS_VERSION,
  };
}
