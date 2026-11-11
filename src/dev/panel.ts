import { INSTALLED_APP_DISPLAY_QUERY } from "@andornaut/game-kit/web/pwa/backNavigation";

import { DEV_TEXT } from "../data/dev";
import { ZONE_MAP } from "../data/map";
import { TEXT } from "../data/text";
import { type SavedSkillGrantResult, SKILL_IDS } from "../progress";
import {
  changeInvulnerability,
  changeSkillOverride,
  developmentFlags,
  regularBrowser,
  skillOverridesFromSearch,
  stageDevelopmentUrl,
} from "./mode";
import { grantAllSavedSkills } from "./savedSkills";

export function developerStages() {
  return ZONE_MAP.destinations
    .map((zone) => ({
      id: zone.id,
      label: TEXT.map.zones[zone.id] ?? zone.id,
      stages: zone.stages
        .filter((id) =>
          ZONE_MAP.nodes.some(
            (node) => node.id === id && node.kind === "zone" && node.zone !== undefined,
          ),
        )
        .map((id) => ({ id, label: TEXT.map.stages[id] ?? id })),
    }))
    .filter((zone) => zone.stages.length > 0);
}
export function panelInputGate(blocked: () => boolean) {
  let generation = 0;
  let armed: number | undefined;
  return {
    accepts: () => !blocked() && armed === generation,
    invalidate: () => {
      generation++;
      armed = undefined;
    },
    press: () => {
      armed = blocked() ? undefined : generation;
    },
  };
}
export function mountDeveloperPanel(
  context: {
    blocked: () => boolean;
    grant: (access: { readonly available: () => boolean }) => Promise<SavedSkillGrantResult>;
    subscribe: (sync: () => void) => () => void;
  },
  host: HTMLElement,
): () => void {
  const { blocked } = context;
  const document = host.ownerDocument;
  const page = document.defaultView!;
  const catalogue = developerStages();
  const container = document.createElement("div");
  container.className = "game-with-dev";
  host.before(container);
  container.append(host);
  const section = document.createElement("section");
  section.className = "dev-tools";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "dev-link";
  toggle.textContent = DEV_TEXT.toggle;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "dev-panel");
  const fields = document.createElement("fieldset");
  fields.id = "dev-panel";
  fields.hidden = true;
  const legend = document.createElement("legend");
  legend.textContent = DEV_TEXT.heading;
  fields.append(legend);
  const group = (heading: string, description: string) => {
    const element = document.createElement("fieldset");
    const title = document.createElement("legend");
    title.textContent = heading;
    const help = document.createElement("p");
    help.textContent = description;
    element.append(title, help);
    fields.append(element);
    return element;
  };
  const savedFields = group(DEV_TEXT.groups.saveChanging, DEV_TEXT.groups.saveChangingDescription);
  const grant = document.createElement("button");
  grant.type = "button";
  grant.textContent = DEV_TEXT.grantAllSkills;
  const result = document.createElement("p");
  result.setAttribute("role", "status");
  result.setAttribute("aria-live", "polite");
  savedFields.append(grant, result);
  const runFields = group(DEV_TEXT.groups.runOnly, DEV_TEXT.groups.runOnlyDescription);
  const labelled = (text: string, control: HTMLElement) => {
    const label = document.createElement("label");
    label.append(document.createTextNode(text), control);
    runFields.append(label);
  };
  const zones = document.createElement("select");
  const stages = document.createElement("select");
  const option = (value: string, text: string) => {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = text;
    return element;
  };
  catalogue.forEach((zone) => zones.append(option(zone.id, zone.label)));
  const asked = new URLSearchParams(page.location.search).get("zone");
  zones.value =
    catalogue.find((zone) => zone.stages.some((stage) => stage.id === asked))?.id ??
    catalogue[0]?.id ??
    "";
  const fillStages = () => {
    stages.replaceChildren();
    catalogue
      .find((zone) => zone.id === zones.value)
      ?.stages.forEach((stage) => stages.append(option(stage.id, stage.label)));
  };
  fillStages();
  if (asked && [...stages.options].some((stage) => stage.value === asked)) {
    stages.value = asked;
  }
  labelled(DEV_TEXT.zone, zones);
  labelled(DEV_TEXT.stage, stages);
  const load = document.createElement("button");
  load.type = "button";
  load.textContent = DEV_TEXT.load;
  runFields.append(load);
  const invulnerable = document.createElement("input");
  invulnerable.type = "checkbox";
  invulnerable.checked = developmentFlags(page.location.search).invulnerable;
  labelled(DEV_TEXT.invulnerable, invulnerable);
  for (const skill of SKILL_IDS) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = skillOverridesFromSearch(page.location.search)[skill] === true;
    labelled(TEXT.skills[skill].title, checkbox);
    checkbox.addEventListener("change", () => {
      if (!gate.accepts()) {
        checkbox.checked = skillOverridesFromSearch(page.location.search)[skill] === true;
        return;
      }
      changeSkillOverride(page, checkbox.checked, skill);
    });
  }
  section.append(toggle, fields);
  container.append(section);
  let disposed = false;
  let pending = false;
  let revision = 0;
  const unavailable = () =>
    blocked() || !regularBrowser(page) || document.visibilityState === "hidden";
  const gate = panelInputGate(() => unavailable() || pending || disposed);
  const invalidate = () => {
    revision++;
    gate.invalidate();
  };
  let previousBlocked = unavailable();
  const sync = () => {
    if (previousBlocked !== unavailable()) {
      invalidate();
    }
    previousBlocked = unavailable();
    section.hidden = !regularBrowser(page);
    toggle.disabled = unavailable() || pending;
    fields.disabled = unavailable() || pending;
  };
  const observer = new MutationObserver(() => {
    invalidate();
    sync();
  });
  observer.observe(host, { attributeFilter: ["data-modal-open"], attributes: true });
  section.addEventListener("pointerdown", () => gate.press());
  section.addEventListener("keydown", (event) => {
    event.stopPropagation();
    gate.press();
    if (event.key === "Escape" && gate.accepts()) {
      event.preventDefault();
      invalidate();
      fields.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });
  section.addEventListener("keyup", (event) => event.stopPropagation());
  toggle.addEventListener("click", () => {
    if (!gate.accepts()) {
      return;
    }
    invalidate();
    fields.hidden = !fields.hidden;
    toggle.setAttribute("aria-expanded", String(!fields.hidden));
  });
  zones.addEventListener("change", () => {
    if (gate.accepts()) {
      fillStages();
    }
  });
  load.addEventListener("click", () => {
    if (
      !gate.accepts() ||
      !catalogue.some((zone) => zone.stages.some((stage) => stage.id === stages.value))
    ) {
      return;
    }
    changeInvulnerability(page, developmentFlags(page.location.search).invulnerable);
    page.location.assign(stageDevelopmentUrl(page.location.href, stages.value));
  });
  invulnerable.addEventListener("change", () => {
    if (!gate.accepts()) {
      invulnerable.checked = developmentFlags(page.location.search).invulnerable;
      return;
    }
    changeInvulnerability(page, invulnerable.checked);
  });
  grant.addEventListener("click", () => {
    if (!gate.accepts() || fields.hidden) {
      return;
    }
    const captured = revision;
    pending = true;
    result.textContent = "";
    sync();
    void Promise.resolve()
      .then(() =>
        grantAllSavedSkills({
          current: () => !disposed && !unavailable() && !fields.hidden && captured === revision,
          grant: context.grant,
          host: page,
        }),
      )
      .then((outcome) => {
        if (!disposed) {
          const completed = outcome.written.map((record) => DEV_TEXT.grantRecords[record]);
          result.textContent = [
            DEV_TEXT.grantResults[outcome.status],
            ...(completed.length > 0 ? [`${DEV_TEXT.grantWritten} ${completed.join(", ")}`] : []),
          ].join(" ");
        }
      })
      .catch(() => {
        if (!disposed) {
          result.textContent = DEV_TEXT.grantResults.unavailable;
        }
      })
      .finally(() => {
        pending = false;
        invalidate();
        if (!disposed) {
          sync();
        }
      });
  });
  const resume = () => {
    invalidate();
    sync();
  };
  const media = page.matchMedia(INSTALLED_APP_DISPLAY_QUERY);
  media.addEventListener("change", sync);
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("visibilitychange", resume);
  page.addEventListener("pageshow", resume);
  page.addEventListener("pagehide", resume);
  sync();
  const unsubscribe = context.subscribe(sync);
  return () => {
    disposed = true;
    invalidate();
    unsubscribe();
    observer.disconnect();
    media.removeEventListener("change", sync);
    document.removeEventListener("fullscreenchange", sync);
    document.removeEventListener("visibilitychange", resume);
    page.removeEventListener("pageshow", resume);
    page.removeEventListener("pagehide", resume);
    section.remove();
    container.before(host);
    container.remove();
  };
}
