import "../gallery/page.css";

import palette from "../../public/art/palette.json";
import { TUNING_GROUPS, tuningRows } from "./catalogue";

for (const [key, colour] of Object.entries(palette.colours)) {
  document.documentElement.style.setProperty(`--palette-${key}`, colour);
}
const host = document.querySelector<HTMLTableSectionElement>("#tuning-values")!;
const rows = tuningRows(TUNING_GROUPS);
const filter = document.querySelector<HTMLInputElement>("#tuning-search")!;
const count = document.querySelector<HTMLOutputElement>("#tuning-count")!;
function render(): void {
  const query = filter.value.trim().toLowerCase();
  const selected = rows.filter(({ group, path, value }) =>
    `${group} ${path} ${value}`.toLowerCase().includes(query),
  );
  host.replaceChildren(
    ...selected.map(({ group, path, value }) => {
      const row = document.createElement("tr");
      for (const text of [group, path, value]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.append(cell);
      }
      return row;
    }),
  );
  count.value = `${selected.length} / ${rows.length}`;
}
filter.addEventListener("input", render);
render();
