import { readUnit } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

import { SETTINGS_CARD } from "../../data/layout.ts";

// One decorative trailing stack for every in-game switch: its role/aria-checked stays on the row.
export function createToggleValue(document: Document): HTMLSpanElement {
  const value = document.createElement("span");
  value.className = "settings-value settings-toggle-value";
  value.setAttribute("aria-hidden", "true");
  const toggle = document.createElement("span");
  toggle.className = "settings-switch";
  const state = document.createElement("span");
  state.className = "settings-state";
  value.append(toggle, state);
  return value;
}

export function showToggleValue(text: string, value: HTMLElement): void {
  value.querySelector<HTMLElement>(".settings-state")!.textContent = text;
}

// Computed CSS widths precede frame rotation; equal logical widths keep all row labels aligned.
export function fitToggleValues(values: readonly HTMLElement[]): void {
  if (!values[0]?.isConnected || values[0].closest("[hidden]") !== null) {
    return;
  }
  for (const value of values) {
    value.style.setProperty("--settings-toggle-width", "max-content");
  }
  const width = Math.max(
    SETTINGS_CARD.switch.width,
    ...values.map((value) => {
      const measured = Number.parseFloat(
        value.ownerDocument.defaultView!.getComputedStyle(value).width,
      );
      return Number.isFinite(measured) ? measured / readUnit(value) : 0;
    }),
  );
  for (const value of values) {
    value.style.setProperty("--settings-toggle-width", `calc(var(--ui-unit) * ${width} * 1px)`);
  }
}
