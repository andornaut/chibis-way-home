import {
  ACTION_GAPS,
  type ActionArrangement,
  type ActionGapSelection,
} from "@andornaut/game-kit/runtime/ui/actionGroup";
import type { ButtonRole, ButtonSize } from "@andornaut/game-kit/runtime/ui/buttonLayout";
import {
  type ActionGroupView,
  createActionGroup,
  type DomAction,
  type DomActionGroupContext,
} from "@andornaut/game-kit/runtime/web/ui/dom/actionGroup";
import { readUnit } from "@andornaut/game-kit/runtime/web/ui/dom/viewUnits";

import { registerLayout, rendered } from "./layout.ts";

// A group of actions in the HTML UI on the kit's action group (actionGroup.css): the group owns
// the gaps between its faces and each action's press area, which reaches the hit margin past its
// face and half the gap toward a neighbour. Each action's box is its face. The DOM order is the
// focus order; the arrangement shows a primary action last.

export type ActionsContext = Omit<DomActionGroupContext, "width">;

export interface ActionsView {
  readonly element: HTMLElement;
  readonly group: ActionGroupView;
  // Measures and places the actions; undefined while the group is not rendered.
  arrange(): ActionArrangement<HTMLElement> | undefined;
}

// A text button's role: art's primary face, or the ordinary one.
export function actionRole(button: HTMLElement): ButtonRole {
  return button.classList.contains("ui-text-button-primary") ? "primary" : "secondary";
}

// Each element as an action at its measured face size.
export function measuredActions(
  group: ActionGroupView,
  elements: readonly HTMLElement[],
  size?: ButtonSize,
): DomAction[] {
  const sizes = size === undefined ? group.measure(elements) : elements.map(() => size);
  return elements.map((element, index) => ({
    element,
    role: actionRole(element),
    // A hidden action has no box to measure, and takes no room.
    size: element.hidden ? { height: 1, width: 1 } : sizes[index]!,
  }));
}

// A row's width: its faces and the gaps between them.
export function rowWidth(gap: ActionGapSelection | undefined, widths: readonly number[]): number {
  const between = typeof gap === "object" ? gap.row : ACTION_GAPS[gap ?? "standard"].row;
  return widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * between;
}

// The group's room across, in base px: its parent's content width.
function room(element: HTMLElement): number {
  const parent = element.parentElement!;
  const style = parent.ownerDocument.defaultView!.getComputedStyle(parent);
  const inner =
    parent.clientWidth -
    Number.parseFloat(style.paddingLeft) -
    Number.parseFloat(style.paddingRight);
  return Math.floor(inner / readUnit(element) + 1e-6);
}

// A group holding elements in their focus order, arranged in context within width base px, or
// within its parent's content width. size fixes every face's size instead of measuring it.
export function createActions(
  document: Document,
  elements: readonly HTMLElement[],
  options: {
    readonly className?: string;
    readonly context?: ActionsContext | (() => ActionsContext);
    readonly size?: () => ButtonSize | undefined;
    // The room across in base px; "content" makes a row exactly as wide as its faces and gaps.
    readonly width?: number | "content";
  } = {},
): ActionsView {
  const group = createActionGroup(
    document,
    options.className === undefined ? {} : { className: options.className },
  );
  group.element.append(...elements);
  const arrange = () => {
    if (!rendered(group.element.parentElement ?? group.element)) {
      return undefined;
    }
    const context = typeof options.context === "function" ? options.context() : options.context;
    const shown = [...group.element.children].filter(
      (child): child is HTMLElement => child !== context?.middle?.element,
    ) as HTMLElement[];
    const actions = measuredActions(group, shown, options.size?.());
    return group.arrange(
      {
        ...context,
        ...(options.width === "content" ? { axis: "row" as const } : {}),
        width:
          options.width === "content"
            ? rowWidth(
                context?.gap,
                actions.filter(({ element }) => !element.hidden).map(({ size }) => size.width),
              )
            : (options.width ?? room(group.element)),
      },
      actions,
    );
  };
  registerLayout(arrange, group.element);
  return { arrange, element: group.element, group };
}
