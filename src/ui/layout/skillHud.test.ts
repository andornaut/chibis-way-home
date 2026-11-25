import { rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import {
  ACTION_GAPS,
  type PlacedAction,
  pressedAction,
} from "@andornaut/game-kit/runtime/ui/actionGroup";
import { hudDiscGeometry } from "@andornaut/game-kit/runtime/ui/hudDisc";
import { describe, expect, it } from "vitest";

import { CONTROL_FRAME_INSET, HUD_EDGE } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import type { SkillId } from "../../data/types/index.ts";
import { SKILL_IDS } from "../../progress/index.ts";
import { HUD_DISC_SIZES } from "./controlChrome.ts";
import { PAUSE_BUTTON } from "./pauseCard.ts";
import { arrangeSkillHud, SKILL_BUTTON, skillButton, skillHud } from "./skillHud.ts";
import { TOP_BAR_CENTRE_Y } from "./topBar.ts";

const placed = (shown: readonly SkillId[]) =>
  arrangeSkillHud(shown).actions.filter(
    (action): action is PlacedAction<SkillId> => !action.hidden,
  );
const right = ({ width, x }: { width: number; x: number }) => x + width;
const bottom = ({ height, y }: { height: number; y: number }) => y + height;

describe("the skill HUD's row", () => {
  it.each([
    { shown: ["doubleJump"] },
    { shown: ["speedy", "dash"] },
    { shown: ["dash", "doubleJump"] },
    { shown: [...SKILL_IDS] },
  ] satisfies { shown: SkillId[] }[])(
    "packs $shown against the view's right as small buttons on whole pixels",
    ({ shown }) => {
      const row = placed(shown);
      expect(row.map(({ key }) => key)).toEqual(SKILL_IDS.filter((id) => shown.includes(id)));
      expect(SCREEN.width - right(row.at(-1)!.face)).toBe(HUD_EDGE);
      row.forEach(({ face, press }, index) => {
        expect([face.width, face.height]).toEqual([SKILL_BUTTON.disc, SKILL_BUTTON.disc]);
        expect([press.width, press.height]).toEqual([SKILL_BUTTON.target, SKILL_BUTTON.target]);
        expect([face.x, face.y, press.x, press.y].every(Number.isInteger)).toBe(true);
        // The disc centres on the top section, and the target on the disc, each with its spare
        // pixel right or below.
        expect(TOP_BAR_CENTRE_Y - face.y - face.height / 2).toBe(0.5);
        expect([right(press) - right(face), bottom(press) - bottom(face)]).toEqual([
          face.x - press.x + 1,
          face.y - press.y + 1,
        ]);
        expect(press.y).toBeGreaterThanOrEqual(0);
        expect(rectsOverlap(press, PAUSE_BUTTON.hit)).toBe(false);
        const next = row[index + 1];
        if (next !== undefined) {
          expect(next.face.x - right(face)).toBe(ACTION_GAPS.small.row);
          expect(next.press.x).toBeGreaterThanOrEqual(right(press));
        }
      });
    },
  );

  it("places the three discs and their targets at these whole base pixels", () => {
    const row = placed(SKILL_IDS);
    expect(row.map(({ face }) => [face.x, face.y])).toEqual([
      [561, 7],
      [618, 7],
      [675, 7],
    ]);
    expect([...skillHud(SKILL_IDS).values()]).toEqual([
      { x: 554, y: 0 },
      { x: 611, y: 0 },
      { x: 668, y: 0 },
    ]);
  });

  it("gives a press between two targets to neither, and one on a target to its skill", () => {
    const arrangement = arrangeSkillHud(SKILL_IDS);
    const [first, second] = placed(SKILL_IDS) as [PlacedAction<SkillId>, PlacedAction<SkillId>];
    const between = { x: (right(first.press) + second.press.x) / 2, y: first.press.y + 1 };
    expect(right(first.press)).toBeLessThan(second.press.x);
    expect(pressedAction(arrangement, between)).toBeUndefined();
    expect(pressedAction(arrangement, { x: right(first.press) - 1, y: first.press.y })).toBe(
      first.key,
    );
    expect(pressedAction(arrangement, { x: second.press.x, y: bottom(second.press) - 1 })).toBe(
      second.key,
    );
  });

  it("centres the glyph's frame on the disc with the spare pixel right and below", () => {
    for (const [index, at] of [...skillHud(SKILL_IDS).values()].entries()) {
      const { face } = placed(SKILL_IDS)[index]!;
      const { icon } = hudDiscGeometry({ origin: face }, HUD_DISC_SIZES.skill);
      const button = skillButton(at);
      expect(button.disc).toEqual({ x: face.x, y: face.y });
      expect(button.glyph).toEqual({ x: icon.x, y: icon.y });
      expect([icon.width, icon.height]).toEqual([SKILL_BUTTON.glyph, SKILL_BUTTON.glyph]);
      expect(right(face) - right(icon)).toBe(icon.x - face.x + 1);
      expect(bottom(face) - bottom(icon)).toBe(icon.y - face.y + 1);
    }
  });

  it.each(SKILL_IDS.map((_, index) => index + 1))(
    "mirrors the entry's disc in the rightmost disc about the view's centre line with %i shown",
    (count) => {
      const entry = {
        x: PAUSE_BUTTON.art.x + CONTROL_FRAME_INSET,
        y: PAUSE_BUTTON.art.y + CONTROL_FRAME_INSET,
      };
      const last = placed(SKILL_IDS.slice(-count)).at(-1)!.face;
      expect(PAUSE_BUTTON.art.width - 2 * CONTROL_FRAME_INSET).toBe(last.width);
      expect({ x: SCREEN.width - entry.x - last.width, y: entry.y }).toEqual({
        x: last.x,
        y: last.y,
      });
    },
  );

  it("gives hidden skills no slot", () => {
    expect(skillHud([]).size).toBe(0);
    expect(skillHud(["dash"]).has("speedy")).toBe(false);
    expect(placed(["dash"])).toHaveLength(1);
  });
});
