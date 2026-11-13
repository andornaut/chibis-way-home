import { describe, expect, it } from "vitest";

import { ACHIEVEMENT_IDS } from "../../progress/index.ts";
import { achievementsCardProperties, achievementsPerPage } from "./achievementsCard.ts";

describe("the Achievements card", () => {
  it("pages all 26 entries, six to a page in three rows, in full pages before the last", () => {
    const perPage = achievementsPerPage();
    expect({
      lastPage: ACHIEVEMENT_IDS.length - 4 * perPage,
      pages: Math.ceil(ACHIEVEMENT_IDS.length / perPage),
      perPage,
      rows: achievementsCardProperties(ACHIEVEMENT_IDS.length)["--achievements-rows"],
    }).toEqual({ lastPage: 2, pages: 5, perPage: 6, rows: 3 });
  });
});
