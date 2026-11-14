export type TextButtonSizing = "authored" | "standard";

// Authored rectangles keep their existing fixed face and target geometry.
export function setTextButtonSizing(sizing: TextButtonSizing, button: HTMLButtonElement): void {
  button
    .querySelector(".ui-text-button-face")!
    .toggleAttribute("data-ui-authored-size", sizing === "authored");
}
