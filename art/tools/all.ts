/**
 * Rebuild all art: every generator's build, in ORDER, from an empty manifest, so a key that no
 * generator draws any longer leaves the manifest without a hand edit.
 *
 * Usage, from the repository root:
 *   node art/tools/all.ts build   run every generator's build in order
 *
 * ORDER runs data, fonts, sprites (bird first: later builds read its exported sheet), contact
 * silhouettes over every contact sprite, tilesets and backdrops (tiles-platforming first: material
 * packs read it), background tones over the backdrops, images and icons.
 *
 * The manifest starts with its SECTIONS in order and no entries except those registered by hand,
 * which no generator writes and which carry over unchanged: the HAND_IMAGES.
 */

import * as achievementIcons from "./achievementIcons.ts";
import * as antagonists from "./antagonists.ts";
import * as apartment from "./apartment.ts";
import * as apartmentProps from "./apartmentProps.ts";
import * as apartmentWayfinding from "./apartmentWayfinding.ts";
import * as backgroundFlora from "./backgroundFlora.ts";
import * as backgroundTones from "./backgroundTones.ts";
import * as bear from "./bear.ts";
import * as bird from "./bird.ts";
import * as bossRemoval from "./bossRemoval.ts";
import * as cast from "./cast.ts";
import { commands, run } from "./cli.ts";
import * as contactSilhouettes from "./contactSilhouettes.ts";
import * as countryside from "./countryside.ts";
import * as cutscene from "./cutscene.ts";
import * as depot from "./depot.ts";
import * as ferret from "./ferret.ts";
import * as ferretAntagonist from "./ferretAntagonist.ts";
import * as ferretParcel from "./ferretParcel.ts";
import * as floor1 from "./floor1.ts";
import * as fonts from "./fonts.ts";
import * as goose from "./goose.ts";
import * as hazards from "./hazards.ts";
import * as homecity from "./homecity.ts";
import * as icons from "./icons.ts";
import * as industrial from "./industrial.ts";
import * as largeWildlife from "./largeWildlife.ts";
import * as logo from "./logo.ts";
import * as map from "./map.ts";
import * as obstacles from "./obstacles.ts";
import * as owl from "./owl.ts";
import * as palette from "./palette.ts";
import * as park from "./park.ts";
import * as pigeonAntagonist from "./pigeonAntagonist.ts";
import * as pigeonPortrait from "./pigeonPortrait.ts";
import * as pixel from "./pixel.ts";
import * as rabbit from "./rabbit.ts";
import * as raccoon from "./raccoon.ts";
import * as roomBuildings from "./roomBuildings.ts";
import * as roomDoors from "./roomDoors.ts";
import * as skillIcons from "./skillIcons.ts";
import * as speakerPortraits from "./speakerPortraits.ts";
import * as start from "./start.ts";
import * as ui from "./ui.ts";
import * as woodland from "./woodland.ts";
import * as woodlandFauna from "./woodlandFauna.ts";
import * as zoneThemes from "./zoneThemes.ts";

const USAGE = "Usage: all.ts build";
// The manifest's sections, in their served order.
const SECTIONS = ["fonts", "sprites", "data", "tilesets", "backdrops", "images"] as const;
// Image entries registered by hand: the stage cutscene placeholder, whose build writes only its
// PNG, and the hand-captured stage previews.
const HAND_IMAGES = /^(stage-cutscene-placeholder|stage-preview-zone-\d+-stage-\d+)$/;

const ORDER: readonly (() => unknown)[] = [
  // Data and fonts.
  zoneThemes.build,
  palette.build,
  fonts.build,
  // Sprites.
  bird.build,
  achievementIcons.build,
  antagonists.build,
  backgroundFlora.build,
  bear.build,
  bossRemoval.build,
  cast.build,
  ferret.build,
  ferretAntagonist.build,
  ferretParcel.build,
  goose.build,
  hazards.build,
  largeWildlife.build,
  map.build,
  owl.build,
  pigeonAntagonist.build,
  pigeonPortrait.build,
  rabbit.build,
  raccoon.build,
  skillIcons.build,
  speakerPortraits.build,
  ui.build,
  woodlandFauna.build,
  contactSilhouettes.build,
  // Tilesets and backdrops.
  obstacles.build,
  floor1.build,
  roomDoors.build,
  apartmentWayfinding.build,
  apartment.build,
  apartmentProps.build,
  countryside.build,
  depot.build,
  homecity.build,
  industrial.build,
  park.build,
  roomBuildings.build,
  woodland.build,
  backgroundTones.build,
  // Images and icons.
  cutscene.build,
  logo.build,
  start.build,
  icons.build,
];

/** The previous manifest's hand-registered entries, every section present and in order. */
function handRegistered(): Record<string, pixel.ManifestEntry[]> {
  const previous = pixel.readManifest();
  return Object.fromEntries(
    SECTIONS.map((section) => [
      section,
      ((previous[section] as pixel.ManifestEntry[] | undefined) ?? []).filter(
        ({ key }) => section === "images" && HAND_IMAGES.test(key),
      ),
    ]),
  );
}

export async function build(): Promise<void> {
  pixel.writeJson({}, pixel.MANIFEST, handRegistered());
  // One build at a time: each reads the manifest and outputs its predecessors wrote.
  await ORDER.reduce(async (previous, step) => {
    await previous;
    await step();
  }, Promise.resolve());
}

if (import.meta.main) {
  run(() => commands({ build, usage: USAGE }));
}
