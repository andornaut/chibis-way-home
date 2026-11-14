// @vitest-environment happy-dom
import { expect, it } from "vitest";

import { TEXT } from "../../data/text.ts";
import { createCard, textButton } from "./card.ts";
import { mountUiLayout, type UiLayoutNode } from "./layoutTree.ts";

it("updates actual production text and button parts without replacing focus or a leading image", () => {
  const host = document.createElement("div");
  const root = document.createElement("section");
  document.body.append(host);
  let button!: HTMLButtonElement;
  const tree = (label: string): UiLayoutNode => ({
    component: "Native",
    key: "screen",
    kind: "component",
    props: { element: root },
    slots: {
      content: [
        {
          component: "Text",
          key: "title",
          kind: "component",
          props: { tag: "h1", text: TEXT.pause.title },
        },
        {
          component: "Button",
          key: "action",
          kind: "component",
          props: {
            label,
            primary: true,
            ref: (created) => {
              button = created;
            },
          },
        },
      ],
    },
  });
  const layout = mountUiLayout(document, host, tree(TEXT.pause.resume));
  const original = button;
  const mark = document.createElement("img");
  button.querySelector(".ui-text-button-label")!.prepend(mark);
  button.focus();
  layout.update(tree(TEXT.pause.close));
  expect(button).toBe(original);
  expect(document.activeElement).toBe(original);
  expect(button.querySelector("img")).toBe(mark);
  expect(button.textContent).toBe(TEXT.pause.close);
  expect(root.children[0]?.textContent).toBe(TEXT.pause.title);
  expect(layout.inspect({ height: 360, width: 720, x: 0, y: 0 }).status).toBe("unavailable");
  layout.dispose();
  host.remove();
});

it("keeps card and text-button facade markup on the production component ports", () => {
  const card = createCard(document, "pause", {
    actions: [
      { key: "settings", label: TEXT.pause.settings },
      { key: "resume", label: TEXT.pause.resume, primary: true },
    ],
    actionsLayout: "stack",
    close: TEXT.pause.close,
    title: TEXT.pause.title,
  });
  expect(card.root.className).toBe("ui-card-scene");
  expect(card.dialog.getAttribute("role")).toBe("dialog");
  expect(card.dialog.getAttribute("aria-labelledby")).toBe("pause-title");
  expect(card.dialog.querySelector(".ui-card-header h2")?.textContent).toBe(TEXT.pause.title);
  expect([...card.dialog.querySelectorAll(".ui-card-actions button")]).toEqual([
    card.buttons.settings,
    card.buttons.resume,
  ]);
  expect(card.buttons.resume.classList.contains("ui-text-button-primary")).toBe(true);
  expect(card.dialog.querySelector(".ui-card-actions")?.classList.contains("ui-button-stack")).toBe(
    true,
  );
  const actions = card.dialog.querySelector<HTMLElement>(".ui-card-actions")!;
  expect(actions.classList.contains("ui-control-group")).toBe(true);
  expect(actions.dataset.uiAxis).toBe("stack");
  expect(card.dialog.lastElementChild).toBe(card.close);
  const button = textButton(document, TEXT.pause.settings);
  expect(button.querySelector(".ui-text-button-face > .ui-text-button-label")?.textContent).toBe(
    TEXT.pause.settings,
  );
});
