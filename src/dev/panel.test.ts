// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEV_TEXT } from "../data/dev.ts";
import { ZONE_MAP } from "../data/map.ts";
import { TEXT } from "../data/text.ts";
import { TOUCH } from "../data/touch.ts";
import { SKILL_IDS } from "../progress/index.ts";
import { assertGameActions } from "../ui/input/actionBinding.ts";
import { developerStages, mountDeveloperPanel, panelInputGate } from "./panel.ts";

const stops: (() => void)[] = [];
const media = { addEventListener() {}, matches: false, removeEventListener() {} };
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function panel(grant: Parameters<typeof mountDeveloperPanel>[0]["grant"] = vi.fn()) {
  window.history.replaceState(null, "", "/play/");
  media.matches = false;
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  const host = document.createElement("div");
  document.body.append(host);
  let blocked = false;
  let sync = () => {};
  const dispose = mountDeveloperPanel(
    {
      blocked: () => blocked,
      grant,
      subscribe: (next) => {
        sync = next;
        return () => {};
      },
    },
    host,
  );
  stops.push(dispose);
  const section = document.querySelector<HTMLElement>(".dev-tools")!;
  const fields = section.querySelector<HTMLFieldSetElement>("#dev-panel")!;
  const button = (text: string) =>
    [...section.querySelectorAll("button")].find((node) => node.textContent === text)!;
  const checkbox = (text: string) =>
    [...section.querySelectorAll("label")]
      .find((node) => node.textContent === text)!
      .querySelector<HTMLInputElement>("input")!;
  return {
    block: (next: boolean) => {
      blocked = next;
      sync();
    },
    button,
    checkbox,
    dispose,
    fields,
    host,
    media,
    section,
    sync: () => sync(),
  };
}
function activate(element: HTMLElement) {
  const key = element instanceof HTMLInputElement ? " " : "Enter";
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key }));
  // Synthetic keys do not run the browser's native activation default in this DOM harness.
  element.click();
}
function pointer(target: HTMLElement, type: string) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: 1,
      clientY: 1,
      isPrimary: true,
      pointerId: 1,
    }),
  );
}
describe("browser developer panel", () => {
  it("derives selectable stages and invalidates captured presses across modals", () => {
    expect(developerStages().flatMap((zone) => zone.stages.map((stage) => stage.id))).toEqual(
      ZONE_MAP.destinations.flatMap((zone) => zone.stages),
    );
    let blocked = false;
    const gate = panelInputGate(() => blocked);
    gate.press();
    const captured = gate.capture();
    expect(gate.accepts()).toBe(true);
    blocked = true;
    gate.invalidate();
    blocked = false;
    expect(captured()).toBe(false);
    expect(gate.accepts()).toBe(false);
    gate.press();
    expect(gate.accepts()).toBe(true);
    expect(captured()).toBe(false);
  });
  it.each(SKILL_IDS)("routes the %s native override through the fresh modal gate", (skill) => {
    const view = panel();
    activate(view.button(DEV_TEXT.toggle));
    const checkbox = view.checkbox(TEXT.skills[skill].title);
    activate(checkbox);
    expect(window.location.search).toContain("devSession=1");
    const enabled = window.location.href;
    view.block(true);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    expect(checkbox.checked).toBe(true);
    expect(window.location.href).toBe(enabled);
    view.block(false);
    activate(checkbox);
    expect(window.location.href).not.toBe(enabled);
    expect(window.location.search).toBe("?devSession=1");
  });
  it("retains native disclosure, controls and Escape focus while hiding cheats under modals", () => {
    const view = panel();
    const toggle = view.button(DEV_TEXT.toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(view.fields.hidden).toBe(true);
    activate(toggle);
    expect(view.fields.hidden).toBe(false);
    const checkbox = view.checkbox(TEXT.skills[SKILL_IDS.at(-1)!].title);
    activate(checkbox);
    activate(toggle);
    activate(toggle);
    expect(checkbox.checked).toBe(true);
    const escape = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" });
    view.section.dispatchEvent(escape);
    expect(view.fields.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(escape.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(toggle);
    expect(checkbox.checked).toBe(true);
    view.block(true);
    expect(toggle.disabled).toBe(true);
    expect(view.fields.disabled).toBe(true);
    expect(view.section.textContent).toContain(DEV_TEXT.load);
    expect(view.section.textContent).toContain(DEV_TEXT.invulnerable);
    expect(view.section.textContent).not.toMatch(/\b(version|build|hash)\b/i);
    view.dispose();
    expect([...document.body.children]).toEqual([view.host]);
  });
});
it("reports partial save outcomes while retaining async modal and disposal guards", async () => {
  let finish!: (result: import("../progress/index.ts").SavedSkillGrantResult) => void;
  let available = () => false;
  const grant = vi.fn((access: { available: () => boolean }) => {
    available = access.available;
    return new Promise<import("../progress/index.ts").SavedSkillGrantResult>((resolve) => {
      finish = resolve;
    });
  });
  const view = panel(grant);
  activate(view.button(DEV_TEXT.toggle));
  const groups = view.fields.querySelectorAll("fieldset");
  expect(groups[0]!.querySelector("legend")!.textContent).toBe(DEV_TEXT.groups.saveChanging);
  expect(groups[1]!.querySelector("legend")!.textContent).toBe(DEV_TEXT.groups.runOnly);
  const button = view.button(DEV_TEXT.grantAllSkills);
  pointer(button, "pointerdown");
  pointer(button, "pointerup");
  button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
  await Promise.resolve();
  expect(grant).toHaveBeenCalledTimes(1);
  expect(view.fields.disabled).toBe(true);
  expect(available()).toBe(true);
  button.click();
  expect(grant).toHaveBeenCalledTimes(1);
  view.block(true);
  view.block(false);
  expect(available()).toBe(false);
  finish({
    cause: "blocked",
    reason: "action_unavailable",
    status: "partial",
    writes: [{ available: true, record: "progress", status: "saved" }],
    written: ["progress"],
  });
  const status = view.section.querySelector('[role="status"]')!;
  await vi.waitFor(() => expect(status.textContent).toContain(DEV_TEXT.grantResults.partial));
  expect(status.textContent).toContain(DEV_TEXT.grantRecords.progress);
  expect(view.fields.disabled).toBe(false);
  activate(button);
  await Promise.resolve();
  view.dispose();
  expect(available()).toBe(false);
  finish({ reason: "action_unavailable", status: "blocked", writes: [], written: [] });
  await Promise.resolve();
  expect([...document.body.children]).toEqual([view.host]);
});
it("hides cheats and rejects stale run and save input after installation", () => {
  const grant = vi.fn();
  const view = panel(grant);
  activate(view.button(DEV_TEXT.toggle));
  view.media.matches = true;
  const checkbox = view.checkbox(TEXT.skills[SKILL_IDS.at(-1)!].title);
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event("change"));
  activate(view.button(DEV_TEXT.grantAllSkills));
  expect(checkbox.checked).toBe(false);
  expect(grant).not.toHaveBeenCalled();
  expect(window.location.search).toBe("");
  view.sync();
  expect(view.section.hidden).toBe(true);
  expect(view.fields.disabled).toBe(true);
  view.media.matches = false;
  view.sync();
  view.button(DEV_TEXT.grantAllSkills).click();
  expect(grant).not.toHaveBeenCalled();
});
it("holds a label or its native checkbox once and cancels a stale modal press", () => {
  vi.useFakeTimers();
  let now = 0;
  vi.spyOn(window.performance, "now").mockImplementation(() => now);
  const view = panel();
  activate(view.button(DEV_TEXT.toggle));
  const checkbox = view.checkbox(DEV_TEXT.invulnerable);
  const label = checkbox.parentElement!;
  for (const target of [label, checkbox]) {
    const before = checkbox.checked;
    pointer(target, "pointerdown");
    now += TOUCH.actionHoldMilliseconds;
    vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
    expect(checkbox.checked).toBe(!before);
    pointer(target, "pointerup");
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    expect(checkbox.checked).toBe(!before);
  }
  const before = checkbox.checked;
  pointer(label, "pointerdown");
  view.block(true);
  view.block(false);
  now += TOUCH.actionHoldMilliseconds;
  vi.advanceTimersByTime(TOUCH.actionHoldMilliseconds);
  pointer(label, "pointerup");
  expect(checkbox.checked).toBe(before);
});

it("rejects a newly constructed discrete control without an action registration", () => {
  const view = panel();
  expect(() => assertGameActions(view.section)).not.toThrow();
  view.section.append(document.createElement("button"));
  expect(() => assertGameActions(view.section)).toThrow(
    "Every discrete control must register its action",
  );
});
