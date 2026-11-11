import type { SavedSkillGrantResult } from "../progress";
import { regularBrowser } from "./mode";

// The captured UI action must remain current through every asynchronous save boundary.
export function grantAllSavedSkills(context: {
  readonly current: () => boolean;
  readonly grant: (access: { readonly available: () => boolean }) => Promise<SavedSkillGrantResult>;
  readonly host: Window;
}): Promise<SavedSkillGrantResult> {
  const available = () => {
    try {
      return regularBrowser(context.host) && context.current();
    } catch {
      return false;
    }
  };
  return available()
    ? context.grant({ available })
    : Promise.resolve({ reason: "action_unavailable", status: "blocked", writes: [], written: [] });
}
