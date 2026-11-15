import type { LayoutNode } from "@andornaut/game-kit/runtime/ui/layoutTree";
import {
  type LayoutComponentPorts,
  type LayoutOptions,
  mountLayout,
} from "@andornaut/game-kit/runtime/web/ui/dom/layoutTree";

import { setTextButtonRole, setTextButtonSizing, type TextButtonSizing } from "./buttonLayout.ts";
import {
  type CardView,
  type CardWords,
  createCardElement,
  createTextButtonElement,
} from "./cardElements.ts";

type TextTag = "h1" | "h2" | "h3" | "p" | "span";
export interface UiTextProps {
  readonly attributes?: Readonly<Record<string, string>>;
  readonly className?: string;
  readonly id?: string;
  readonly ref?: (element: HTMLElement) => void;
  readonly tag: TextTag;
  readonly text: string;
}
export interface UiButtonProps {
  readonly sizing?: TextButtonSizing;
  readonly control?: string;
  readonly disabled?: boolean;
  readonly hidden?: boolean;
  readonly label: string;
  readonly primary?: boolean;
  readonly ref?: (button: HTMLButtonElement) => void;
}
export interface UiCardProps {
  readonly id: string;
  readonly ref?: (view: CardView<string>) => void;
  readonly words: CardWords<string>;
}
export interface UiNativeProps {
  // Each runtime or mock invocation supplies fresh nodes from the same production factory.
  readonly content?: HTMLElement;
  readonly element: HTMLElement;
}
export type UiLayoutSchema = {
  Button: { readonly props: UiButtonProps; readonly slots: never };
  Card: { readonly props: UiCardProps; readonly slots: never };
  Native: { readonly props: UiNativeProps; readonly slots: "content" };
  Text: { readonly props: UiTextProps; readonly slots: never };
};
export type UiLayoutNode = LayoutNode<UiLayoutSchema>;

function buttonLabel(text: string, button: HTMLButtonElement): void {
  const label = button.querySelector(".ui-text-button-label")!;
  const node = [...label.childNodes].find((child) => child.nodeType === 3);
  if (node === undefined) {
    label.append(button.ownerDocument.createTextNode(text));
  } else if (node.textContent !== text) {
    node.textContent = text;
  }
}

// These ports create the real game parts. Trees own composition; scene controllers own actions.
export function createUiLayoutPorts(document: Document): LayoutComponentPorts<UiLayoutSchema> {
  return {
    Button: {
      create(initial) {
        const element = createTextButtonElement(document, initial.label, initial.primary);
        const update = (props: UiButtonProps) => {
          buttonLabel(props.label, element);
          setTextButtonSizing(props.sizing ?? "standard", element);
          element.classList.toggle("ui-text-button-primary", props.primary === true);
          setTextButtonRole(props.primary === true, element);
          element.disabled = props.disabled === true;
          element.hidden = props.hidden === true;
          if (props.control === undefined) {
            delete element.dataset.control;
          } else {
            element.dataset.control = props.control;
          }
          props.ref?.(element);
        };
        update(initial);
        return { dispose() {}, element, slots: {}, update };
      },
      slots: [],
    },
    Card: {
      create(initial) {
        const view = createCardElement(document, initial.id, initial.words);
        const keys = initial.words.actions.map(({ key }) => key);
        const update = (props: UiCardProps) => {
          if (
            props.id !== initial.id ||
            (props.words.close === undefined) !== (initial.words.close === undefined) ||
            (props.words.text === undefined) !== (initial.words.text === undefined) ||
            props.words.actions.map(({ key }) => key).join("\0") !== keys.join("\0")
          ) {
            throw new RangeError("Changed card structure requires a new layout key");
          }
          view.dialog.setAttribute("role", props.words.alert ? "alertdialog" : "dialog");
          view.dialog.querySelector(".ui-card-title")!.textContent = props.words.title;
          const text = view.dialog.querySelector(".ui-card-text");
          if (text !== null) {
            text.textContent = props.words.text!;
          }
          view.dialog
            .querySelector(".ui-card-actions")!
            .classList.toggle("ui-button-stack", props.words.actionsLayout === "stack");
          (view.dialog.querySelector(".ui-card-actions") as HTMLElement).dataset.uiAxis =
            props.words.actionsLayout === "stack" ? "stack" : "row";
          for (const action of props.words.actions) {
            const button = view.buttons[action.key]!;
            buttonLabel(action.label, button);
            button.classList.toggle("ui-text-button-primary", action.primary === true);
            setTextButtonRole(action.primary === true, button);
          }
          if (view.close !== undefined) {
            view.close.setAttribute("aria-label", props.words.close!);
          }
          props.ref?.(view);
        };
        update(initial);
        return { dispose() {}, element: view.root, slots: {}, update };
      },
      slots: [],
    },
    Native: {
      create(initial) {
        if (initial.element.classList.contains("ui-card-actions")) {
          initial.element.classList.add("ui-control-group");
          initial.element.dataset.uiAxis = initial.element.classList.contains("ui-button-stack")
            ? "stack"
            : "row";
        }
        const content = initial.content ?? initial.element;
        if (!initial.element.contains(content)) {
          throw new RangeError("Native layout content must belong to its production root");
        }
        return {
          dispose() {},
          element: initial.element,
          slots: { content },
          update(props) {
            if (props.element !== initial.element || (props.content ?? props.element) !== content) {
              throw new RangeError("Changed native roots require a new layout key");
            }
          },
        };
      },
      slots: ["content"],
    },
    Text: {
      create(initial) {
        const element = document.createElement(initial.tag);
        let attributes: readonly string[] = [];
        const update = (props: UiTextProps) => {
          if (props.tag !== initial.tag) {
            throw new RangeError("Changed text tags require a new layout key");
          }
          element.className = props.className ?? "";
          element.id = props.id ?? "";
          if (element.textContent !== props.text) {
            element.textContent = props.text;
          }
          for (const name of attributes) {
            element.removeAttribute(name);
          }
          for (const [name, value] of Object.entries(props.attributes ?? {})) {
            element.setAttribute(name, value);
          }
          attributes = Object.keys(props.attributes ?? {});
          props.ref?.(element);
        };
        update(initial);
        return { dispose() {}, element, slots: {}, update };
      },
      slots: [],
    },
  };
}

// No measure callback means unavailable physical evidence, including in a headless DOM.
export function mountUiLayout(
  document: Document,
  host: HTMLElement,
  tree: UiLayoutNode,
  options: Pick<LayoutOptions<UiLayoutSchema>, "measure" | "restoreFocus"> = {},
) {
  return mountLayout<UiLayoutSchema>(
    { ...options, components: createUiLayoutPorts(document), host },
    tree,
  );
}
