import type { ButtonMetrics } from "@andornaut/game-kit/runtime/ui/buttonLayout";
import {
  setButtonFrame,
  setButtonRole,
  setButtonSize,
} from "@andornaut/game-kit/runtime/web/ui/dom/buttonLayout";

import { TEXT_BUTTON } from "../../data/layout.ts";

export const BUTTON_TOKENS = {
  standard: {
    height: TEXT_BUTTON.height,
    minWidth: 2 * TEXT_BUTTON.inset,
    paddingX: TEXT_BUTTON.inset,
    paddingY: TEXT_BUTTON.verticalInset,
  },
} as const satisfies Readonly<Record<string, ButtonMetrics>>;

export const BUTTON_FACE_INSETS = {
  bottom: TEXT_BUTTON.lipHeight,
  left: 0,
  right: 0,
  top: 0,
} as const;

// Shared minima are inherited from the layer.
export function setButtonLayoutDefaults(root: HTMLElement): void {
  setButtonSize(BUTTON_TOKENS, "standard", root);
  setButtonFrame({ faceInsets: BUTTON_FACE_INSETS }, root);
}

export function setTextButtonRole(primary: boolean, button: HTMLButtonElement): void {
  setButtonRole(
    primary ? "primary" : "secondary",
    button.querySelector<HTMLElement>(".ui-text-button-face")!,
  );
}

// Native rounded borders remain the skin's geometry, including its existing padding compensation.
export function refreshTextButtonFrames(root: HTMLElement): void {
  const view = root.ownerDocument.defaultView;
  if (view === null) {
    return;
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>(".ui-text-button")) {
    const face = button.querySelector<HTMLElement>(".ui-text-button-face");
    if (face === null) {
      continue;
    }
    setTextButtonRole(button.classList.contains("ui-text-button-primary"), button);
    const style = view.getComputedStyle(face);
    const borderWidths = {
      bottom: Number.parseFloat(style.borderBottomWidth),
      left: Number.parseFloat(style.borderLeftWidth),
      right: Number.parseFloat(style.borderRightWidth),
      top: Number.parseFloat(style.borderTopWidth),
    };
    if (Object.values(borderWidths).every((value) => Number.isFinite(value) && value >= 0)) {
      setButtonFrame(
        {
          borderWidths,
          faceInsets:
            button.disabled || button.getAttribute("aria-disabled") === "true"
              ? { ...BUTTON_FACE_INSETS, bottom: 0 }
              : BUTTON_FACE_INSETS,
        },
        face,
      );
    }
  }
}

export function watchTextButtonFrames(root: HTMLElement): () => void {
  const refresh = () => refreshTextButtonFrames(root);
  const observer = new MutationObserver(refresh);
  observer.observe(root, {
    attributeFilter: ["aria-disabled", "class", "disabled"],
    attributes: true,
    childList: true,
    subtree: true,
  });
  root.ownerDocument.fonts?.addEventListener("loadingdone", refresh);
  return () => {
    observer.disconnect();
    root.ownerDocument.fonts?.removeEventListener("loadingdone", refresh);
  };
}
