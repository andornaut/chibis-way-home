# Art inventory

Every served art asset. Sizes are in base pixels at 720x360. Tags are in frame order. A nine-slice lists its margins as left, top, right, bottom.

## Data

| Key                 | Type                             | Size                        | Tags |
| ------------------- | -------------------------------- | --------------------------- | ---- |
| contact-silhouettes | JSON: per-frame opaque body runs | six antagonist body sprites |      |
| palette             | JSON: colours, darker, dim2      | house and zone ramps        |      |
| zone-themes         | JSON: destination primary tokens | six destinations            |      |

## Fonts

| Key        | Type               | Size         | Tags |
| ---------- | ------------------ | ------------ | ---- |
| font-body  | BMFont, Tiny5      | 8px, line 10 |      |
| font-title | BMFont, Silkscreen | 8px, line 12 |      |

## Icons

Plain PNGs and one ICO from `art/tools/icons.py`, not manifest entries.

| Key               | Type                                        | Size    | Path                                 |
| ----------------- | ------------------------------------------- | ------- | ------------------------------------ |
| apple-touch-icon  | icon, sunburst square                       | 180x180 | `public/icons/apple-touch-icon.png`  |
| favicon           | favicon, disc on transparent                | 32x32   | `public/art/favicon.png`             |
| favicon-16        | favicon, disc on transparent                | 16x16   | `public/art/favicon-16.png`          |
| favicon-ico       | ICO holding favicon-16 and favicon          | 16, 32  | `public/favicon.ico`                 |
| icon-192          | web manifest icon, disc on transparent      | 192x192 | `public/icons/icon-192.png`          |
| icon-512          | web manifest icon, disc on transparent      | 512x512 | `public/icons/icon-512.png`          |
| icon-maskable-512 | maskable icon, sunburst square, central 80% | 512x512 | `public/icons/icon-maskable-512.png` |

## Images

Plain PNGs from their drawing tools, listed in the manifest under `images` with their sizes.

| Key                        | Type                                              | Size    | Path                                               |
| -------------------------- | ------------------------------------------------- | ------- | -------------------------------------------------- |
| logo                       | title-screen logo                                 | 558x239 | `public/art/logo.png`                              |
| logo-icon                  | nav-column logo: bird on a platform, no lettering | 53x41   | `public/art/logo-icon.png`                         |
| logo-nav                   | nav-bar logo, one line                            | 226x30  | `public/art/logo-nav.png`                          |
| stage-cutscene-placeholder | neutral stage-transition illustration             | 720x360 | `public/art/images/stage-cutscene-placeholder.png` |

## Opening story

The [opening asset table](opening/README.md#assets) lists the three storybook backgrounds and four pose sheets, including their dimensions and purposes. The [opening contract](opening/contract.json) defines pose indices, anchors and layer order. These assets are registered under the manifest's `images` and `sprites` entries.

## Sprites

| Key                       | Type                                                       | Size   | Tags                                          |
| ------------------------- | ---------------------------------------------------------- | ------ | --------------------------------------------- |
| bird                      | character                                                  | 48x42  | idle, walk, jump, flutter, land, death (once) |
| dog-pug                   | street cast                                                | 44x32  | idle, walk, perk (once), talk                 |
| ferret                    | character, upright champagne ferret                        | 64x80  | idle, scheme, talk                            |
| ferret-trap-snap          | hazard, hit box 4,14,42,12                                 | 50x26  | set, snap (once)                              |
| frog-courier              | hazard, hit box 6,6,48,30                                  | 60x36  | ride, idle                                    |
| icon-browser-menu         | sprite                                                     | 16x16  | rest                                          |
| icon-exit                 | sprite                                                     | 16x16  | rest                                          |
| icon-home                 | sprite                                                     | 16x16  | rest                                          |
| icon-home-nav             | sprite                                                     | 20x20  | rest                                          |
| icon-install              | sprite                                                     | 16x16  | rest                                          |
| icon-ios-share            | sprite                                                     | 16x16  | rest                                          |
| icon-move-controls        | sprite                                                     | 16x16  | rest                                          |
| icon-settings             | sprite                                                     | 16x16  | rest                                          |
| icon-settings-nav         | sprite                                                     | 20x20  | rest                                          |
| icon-touch-controls       | sprite                                                     | 16x16  | rest                                          |
| map-compass               | map pen mark, tan                                          | 25x33  | rest                                          |
| map-bird                  | map marker, the bird at half size                          | 26x22  | idle                                          |
| map-fork                  | map fork marker                                            | 29x29  | normal, current, visited, unbuilt             |
| map-hill                  | map pen mark, tan                                          | 20x11  | rest                                          |
| map-icon-apartment        | map zone icon, apartment building                          | 14x14  | normal, visited                               |
| map-icon-blue-cityscape   | map zone icon, city towers                                 | 14x14  | normal, visited                               |
| map-icon-countryside      | map zone icon, farm and fields                             | 14x14  | normal, visited                               |
| map-icon-home-city        | map zone icon, neighbourhood house                         | 14x14  | normal, visited                               |
| map-icon-industrial       | map zone icon, factory                                     | 14x14  | normal, visited                               |
| map-icon-street           | map zone icon, brownstone                                  | 14x14  | normal, visited                               |
| map-icon-woodland         | map zone icon, trees                                       | 14x14  | normal, visited                               |
| map-icon-zone             | map zone icon, generic map pin                             | 14x14  | normal, visited                               |
| map-paper                 | nine-slice (13,13,13,13), pale steel map frame             | 32x32  | rest                                          |
| map-region-apartment      | decorative destination illustration                        | 120x60 | rest                                          |
| map-region-blue-cityscape | decorative destination illustration                        | 120x60 | rest                                          |
| map-region-countryside    | decorative destination illustration                        | 120x60 | rest                                          |
| map-region-home-city      | decorative destination illustration                        | 120x60 | rest                                          |
| map-region-industrial     | decorative destination illustration                        | 120x60 | rest                                          |
| map-region-woodland       | decorative destination illustration                        | 120x60 | rest                                          |
| map-wave                  | map pen mark, tan                                          | 22x4   | rest                                          |
| map-zone                  | map zone marker                                            | 35x35  | normal, current, visited, locked, unbuilt     |
| park-boat                 | park, moving platform: deck line on row 0, collision 72x12 | 72x18  | idle                                          |
| park-gate                 | park room door, a Use zone, no collision                   | 36x60  | idle, open (once)                             |
| pedestrian-cat            | street cast                                                | 34x50  | walk, idle                                    |
| pedestrian-raccoon        | street cast                                                | 36x50  | walk, idle                                    |
| pigeon                    | street cast                                                | 22x22  | idle, flee (once), fly                        |
| portrait-bird             | portrait                                                   | 64x64  | neutral, happy, worried                       |
| portrait-ferret           | portrait                                                   | 64x64  | neutral, smug, annoyed                        |
| portrait-pigeon           | Pebble dialogue portrait, transparent                      | 64x64  | neutral                                       |
| ui-answer                 | sprite                                                     | 208x36 | normal, selected, pressed                     |
| ui-button                 | nine-slice (2,4,2,6)                                       | 16x28  | normal, pressed                               |
| ui-button-primary         | nine-slice (2,4,2,6)                                       | 16x28  | normal, pressed                               |
| ui-close                  | sprite                                                     | 24x24  | normal, pressed                               |
| ui-dialogue-box           | sprite                                                     | 640x96 | rest                                          |
| ui-focus                  | nine-slice (4,4,4,4)                                       | 16x16  | rest                                          |
| ui-forward-mark           | sprite                                                     | 10x14  | idle                                          |
| ui-icon-button            | sprite                                                     | 36x36  | normal, pressed                               |
| ui-move-hint              | sprite                                                     | 75x75  | rest, held-left, held-right                   |
| ui-move-knob              | sprite                                                     | 11x11  | rest, held                                    |
| ui-name-tab               | nine-slice (2,2,2,2)                                       | 12x20  | amber, green, pink, tan                       |
| ui-nav-bar                | nine-slice (1,1,1,3)                                       | 12x48  | rest                                          |
| ui-pause                  | sprite                                                     | 35x35  | rest, press, held                             |
| ui-play-mark              | sprite                                                     | 5x10   | rest                                          |
| ui-portrait-frame         | sprite                                                     | 68x68  | rest                                          |
| ui-quip-strip             | nine-slice (2,2,2,2)                                       | 12x24  | rest                                          |
| ui-quit                   | sprite                                                     | 20x20  | normal, pressed                               |
| ui-resume                 | sprite                                                     | 160x44 | normal, pressed                               |
| ui-settings-card          | nine-slice (2,2,2,2)                                       | 16x16  | rest                                          |
| ui-skip                   | sprite                                                     | 78x20  | normal, pressed, disabled                     |
| ui-start                  | sprite                                                     | 192x52 | normal, pressed                               |
| ui-switch                 | sprite                                                     | 32x16  | on, off                                       |
| ui-touch-jump             | sprite                                                     | 75x75  | rest, press, held                             |
| ui-touch-use              | sprite                                                     | 75x75  | rest, press, held                             |

## Tilesets

12x12 tiles in rows of 8, from `art/tools/floor1.py`. One-way ledges are named `one-way-*`; doorways (`door-*`, `exit-*`) and pits (`pit-*`) have no collision.

| Key          | Type                                                                                                                                                       | Size            | Pieces      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------- |
| tiles-lobby  | tileset (kept for a later indoor zone): wood floor, one-way balcony, shelf, cushion and desk, wood post, stairwell exit                                    | 130 tiles, 12px | exit (7x15) |
| tiles-street | tileset: sidewalk, kerb, road, one-way awning, one-way canopy, planter, door, cellar hatch, one-way fire-escape landing, sill, cornice and water-tower top | 54 tiles, 12px  | door (3x4)  |
| tiles-park   | tileset (park theme): grass, turf, soil, path, stone stairs, one-way bench, branch and bandstand, pond and thorn hazards                                   | 32 tiles, 12px  |             |

## Backdrops

Pieces placed from stage data by their bottom-left corner at the bottom y given, from `art/tools/floor1.py` (Zone 1: New York street, 720px tall, sidewalk top y 600, row 50).

| Key                     | Type                                                                 | Size    | Bottom y, repeat |
| ----------------------- | -------------------------------------------------------------------- | ------- | ---------------- |
| cab                     | street furniture, yellow cab                                         | 96x40   | 600, none        |
| canopy-poles            | street furniture, under the canopy                                   | 60x60   | 600, none        |
| cross-street            | far avenue down a cross street                                       | 120x26  | 600, none        |
| doorman-podium          | street furniture                                                     | 18x24   | 600, none        |
| facade-brownstone       | building facade, brownstone                                          | 48x312  | 600, x           |
| facade-brownstone-upper | building facade, a brownstone's upper storey                         | 48x180  | 288, x           |
| facade-hotel            | building facade, tall dark stone (generic until the exit is decided) | 48x312  | 600, x           |
| facade-hotel-upper      | building facade, the tall stone building's upper storey              | 48x180  | 288, x           |
| facade-one-storey       | building facade, one-storey brick                                    | 48x192  | 600, x           |
| facade-walkup           | building facade, brick walk-up                                       | 48x312  | 600, x           |
| facade-walkup-upper     | building facade, a walk-up's upper storey                            | 48x180  | 288, x           |
| fire-escape             | facade piece, walk-up                                                | 196x185 | 473, none        |
| fire-escape-ladder      | climbing, fire-escape ladder between landings 8 rows apart           | 24x96   | 432, none        |
| fire-escape-ladder-4    | climbing, fire-escape ladder between landings 4 rows apart           | 24x48   | 432, none        |
| fire-escape-ladder-5    | climbing, fire-escape ladder between landings 5 rows apart           | 24x60   | 432, none        |
| fire-escape-ladder-6    | climbing, fire-escape ladder between landings 6 rows apart           | 24x72   | 432, none        |
| fire-escape-ladder-7    | climbing, fire-escape ladder between landings 7 rows apart           | 24x84   | 432, none        |
| fire-escape-railing     | climbing, fire-escape railing on a landing                           | 48x24   | 432, x           |
| hot-dog-cart            | street furniture                                                     | 40x70   | 600, none        |
| hotel-crest             | facade piece, banners and crest (generic)                            | 98x44   | 478, none        |
| hotel-window            | facade piece, tall window (generic)                                  | 32x152  | 592, none        |
| lobby-balustrade        | lobby (later indoor zone), balcony railing                           | 48x36   | balcony line, x  |
| lobby-bookcase          | lobby (later indoor zone), tall bookcase                             | 84x384  | 672, none        |
| lobby-desk              | lobby (later indoor zone), reception desk                            | 120x96  | 672, none        |
| lobby-front-door        | lobby (later indoor zone), inside of the front door                  | 156x180 | 672, none        |
| lobby-lamp              | lobby (later indoor zone), pendant lamp, lit bulb                    | 48x192  | 220, none        |
| lobby-plant             | lobby (later indoor zone), potted plant                              | 48x120  | 672, none        |
| lobby-sofa              | lobby (later indoor zone), sofa                                      | 120x72  | 672, none        |
| lobby-wall              | lobby wall (later indoor zone), wood panelling                       | 48x720  | 720, x           |
| lobby-window            | lobby (later indoor zone), tall window                               | 96x240  | 552, none        |
| park-bandstand          | park prop, bandstand under its one-way roof                          | 120x84  | 600, none        |
| park-bench              | park prop, bench under its one-way top                               | 36x24   | 600, none        |
| park-bin                | park prop, bin                                                       | 16x24   | 600, none        |
| park-city               | park, the city behind                                                | 360x200 | 540, x           |
| park-clouds             | park, cream clouds                                                   | 360x160 | 200, x           |
| park-far-trees          | park, distant crowns                                                 | 240x120 | 600, x           |
| park-flower-bed         | park prop, flower bed                                                | 72x16   | 600, none        |
| park-fountain           | park prop, fountain                                                  | 96x48   | 600, none        |
| park-lamp               | park prop, lamp                                                      | 16x84   | 600, none        |
| park-lily-pad           | park prop, lily pad                                                  | 14x4    | 608, none        |
| park-reeds              | park prop, pond reeds                                                | 24x30   | 610, none        |
| park-sign               | park prop, sign with a tree icon                                     | 24x40   | 600, none        |
| park-sky                | park, peach sky                                                      | 48x600  | 600, x           |
| park-tree               | park prop, autumn tree                                               | 96x150  | 600, none        |
| park-treetops           | park, tall autumn treetops                                           | 360x420 | 600, x           |
| roofline-brownstone     | roofline, brownstone                                                 | 48x48   | 108, x           |
| roofline-hotel          | roofline, tall stone building                                        | 48x48   | 108, x           |
| roofline-walkup         | roofline, walk-up                                                    | 48x48   | 108, x           |
| storefront-cafe         | storefront, cup sign                                                 | 84x120  | 600, none        |
| storefront-diner        | storefront, fork-and-knife sign                                      | 108x120 | 600, none        |
| storefront-florist      | storefront, flower sign                                              | 84x120  | 600, none        |
| storefront-gift-shop    | storefront, gift sign                                                | 96x120  | 600, none        |
| storefront-makeup-store | storefront, lipstick sign                                            | 96x120  | 600, none        |
| storefront-noodle-bar   | storefront, noodle-bowl sign                                         | 120x120 | 600, none        |
| storefront-pet-shop     | storefront, paw sign                                                 | 108x120 | 600, none        |
| street-sky              | day sky, both screens                                                | 48x600  | 600, x           |
| street-skyline          | far skyline, water towers, two towers                                | 336x600 | 600, x           |
| street-tree             | street furniture                                                     | 64x136  | 600, none        |
| subway-railing          | street furniture                                                     | 72x62   | 600, none        |
| walk-signal             | street furniture                                                     | 12x82   | 600, none        |
| water-tower             | climbing, water tower (top one-way tiles)                            | 48x84   | 240, none        |

## Modular platforming

| Key               | Type                               | Size  | Contents                                                                               |
| ----------------- | ---------------------------------- | ----- | -------------------------------------------------------------------------------------- |
| tiles-platforming | tileset, 12px cells, eight columns | 96x36 | 17 tiles: solid faces and corners, one-way ledges, four directional red contact strips |

## Street atmosphere layers

| Key             | Type               | Size    | Placement                                    |
| --------------- | ------------------ | ------- | -------------------------------------------- |
| street-city-far | repeating backdrop | 720x600 | bottom-left, y 600, repeat x; far skyline    |
| street-city-mid | repeating backdrop | 720x600 | bottom-left, y 600, repeat x; middle skyline |

## Depot modules

| Key               | Type                                        | Size    | Placement                                  |
| ----------------- | ------------------------------------------- | ------- | ------------------------------------------ |
| depot-loading-bay | static backdrop, roller bay and parcel icon | 120x120 | bottom-left, y 600, no repeat              |
| depot-wall        | static ribbed blue-grey wall                | 48x180  | bottom-left, y 600, repeat x               |
| parcel-open       | static opened cardboard parcel              | 72x36   | bottom-left, y 600, no repeat; behind bird |

## Dog antagonist

| Key            | Type                                  | Size  | Tags                                                |
| -------------- | ------------------------------------- | ----- | --------------------------------------------------- |
| dog-antagonist | Archie character; hit box 2,2,56,38   | 60x40 | idle, walk, crouch, rush, rest, frustration, pounce |
| portrait-dog   | Archie dialogue portrait, transparent | 64x64 | neutral                                             |

## Apartment building blocks

| Key                          | Type                               | Size    | Contract                                        |
| ---------------------------- | ---------------------------------- | ------- | ----------------------------------------------- |
| apartment-exterior-mid       | decorative backdrop                | 720x720 | Bottom-left, y 720, repeat x                    |
| apartment-facade             | decorative backdrop                | 48x180  | Bottom-left, y 720, repeat x                    |
| apartment-far                | decorative backdrop                | 720x720 | Bottom-left, y 720, repeat x                    |
| apartment-lobby-desk         | decorative backdrop                | 96x48   | Bottom-left, y 720, repeat none                 |
| apartment-lobby-plant        | decorative backdrop                | 36x60   | Bottom-left, y 720, repeat none                 |
| apartment-lobby-sofa         | decorative backdrop                | 96x48   | Bottom-left, y 720, repeat none                 |
| apartment-pool-bench         | decorative backdrop                | 72x36   | Bottom-left, y 720, repeat none                 |
| apartment-pool-water         | decorative backdrop                | 96x24   | Bottom-left, y 720, repeat x                    |
| apartment-residential-shelf  | decorative backdrop                | 72x96   | Bottom-left, y 720, repeat none                 |
| apartment-restaurant-booth   | decorative backdrop                | 72x48   | Bottom-left, y 720, repeat none                 |
| apartment-restaurant-counter | decorative backdrop                | 96x48   | Bottom-left, y 720, repeat none                 |
| apartment-room-door          | decorative backdrop                | 48x72   | Bottom-left, y 720, repeat none                 |
| apartment-sky                | decorative backdrop                | 48x720  | Bottom-left, y 720, repeat x                    |
| apartment-spa-bench          | decorative backdrop                | 72x36   | Bottom-left, y 720, repeat none                 |
| apartment-spa-screen         | decorative backdrop                | 72x96   | Bottom-left, y 720, repeat none                 |
| apartment-stairwell          | decorative backdrop                | 48x72   | Bottom-left, y 720, repeat none                 |
| apartment-stairwell-down     | decorative backdrop                | 48x72   | Bottom-left, y 720, repeat none                 |
| apartment-wall-lobby         | decorative backdrop                | 48x144  | Bottom-left, y 720, repeat x                    |
| apartment-wall-pool          | decorative backdrop                | 48x144  | Bottom-left, y 720, repeat x                    |
| apartment-wall-residential   | decorative backdrop                | 48x144  | Bottom-left, y 720, repeat x                    |
| apartment-wall-restaurant    | decorative backdrop                | 48x144  | Bottom-left, y 720, repeat x                    |
| apartment-wall-spa           | decorative backdrop                | 48x144  | Bottom-left, y 720, repeat x                    |
| tiles-apartment              | tileset, 12px cells, eight columns | 96x72   | Six material families, seven terrain tiles each |

## Ferret obstacle skin

| Key               | Type                                 | Size  | Tags                                               |
| ----------------- | ------------------------------------ | ----- | -------------------------------------------------- |
| ferret-antagonist | character; hit box 2,2,44,46         | 48x48 | idle, walk, crouch, rush, rest, frustration, throw |
| ferret-parcel     | active projectile; hit box 4,8,16,16 | 24x24 | idle                                               |

## Countryside materials

| Key               | Type                               | Size    | Contract                                         |
| ----------------- | ---------------------------------- | ------- | ------------------------------------------------ |
| countryside-far   | repeating backdrop                 | 720x600 | Bottom-left, y 600, repeat x                     |
| countryside-sky   | repeating backdrop                 | 48x600  | Bottom-left, y 600, repeat x                     |
| farmland-barn     | decorative backdrop                | 120x144 | Bottom-left, y 600, no repeat                    |
| farmland-fence    | repeating backdrop                 | 48x48   | Bottom-left, y 600, repeat x                     |
| farmland-mid      | repeating backdrop                 | 720x600 | Bottom-left, y 600, repeat x                     |
| river-mid         | repeating backdrop                 | 720x600 | Bottom-left, y 600, repeat x                     |
| river-reeds       | repeating backdrop                 | 48x72   | Bottom-left, y 600, repeat x                     |
| tiles-countryside | tileset, 12px cells, eight columns | 96x48   | Four material families, seven terrain tiles each |

## Goose antagonist

| Key              | Type                                           | Size  | Tags                                                |
| ---------------- | ---------------------------------------------- | ----- | --------------------------------------------------- |
| goose-antagonist | Trixi character; hit box 2,2,44,46             | 48x48 | idle, walk, warn, rush, rest, frustration, set-trap |
| goose-trap       | Arming floor hazard; approved hit box 0,8,24,4 | 24x12 | warning, armed                                      |

## Bini bear

| Key             | Type                              | Size  | Tags                                                                      |
| --------------- | --------------------------------- | ----- | ------------------------------------------------------------------------- |
| bear-antagonist | Bini character; hit box 2,2,44,46 | 48x48 | idle, prepare, growl, walk, rush, maul, rest, frustration, prepare-attack |
| bear-growl-wave | Noncolliding directional effect   | 48x32 | pulse (once)                                                              |
| portrait-bear   | Right-facing dialogue portrait    | 64x64 | neutral, annoyed                                                          |

## Owl antagonist

| Key            | Type                         | Size  | Tags                                           |
| -------------- | ---------------------------- | ----- | ---------------------------------------------- |
| owl-antagonist | character; hit box 2,2,44,46 | 48x48 | drop, idle, prepare, rest, return, frustration |

## Woodland materials

| Key            | Type                               | Size    | Contract                                         |
| -------------- | ---------------------------------- | ------- | ------------------------------------------------ |
| forest-mid     | decorative backdrop                | 720x600 | Bottom-left, y 600, repeat x                     |
| forest-shrub   | decorative backdrop                | 48x48   | Bottom-left, y 600, repeat x                     |
| forest-tree    | decorative backdrop                | 96x216  | Bottom-left, y 600, repeat none                  |
| ravine-mid     | decorative backdrop                | 720x600 | Bottom-left, y 600, repeat x                     |
| ravine-rock    | decorative backdrop                | 72x72   | Bottom-left, y 600, repeat none                  |
| tiles-woodland | tileset, 12px cells, eight columns | 96x48   | Four material families, seven terrain tiles each |
| woodland-far   | decorative backdrop                | 720x600 | Bottom-left, y 600, repeat x                     |
| woodland-sky   | decorative backdrop                | 48x600  | Bottom-left, y 600, repeat x                     |

## Rabbit antagonist

| Key               | Type                         | Size  | Tags                         |
| ----------------- | ---------------------------- | ----- | ---------------------------- |
| rabbit-antagonist | character; hit box 2,2,44,46 | 48x48 | hop, idle, rest, frustration |

## Home city materials

| Key                | Type                               | Size    | Contract                                         |
| ------------------ | ---------------------------------- | ------- | ------------------------------------------------ |
| homecity-awning    | decorative backdrop                | 96x36   | Bottom-left, y 600, repeat none                  |
| homecity-far       | decorative backdrop                | 720x600 | Bottom-left, y 600, repeat x                     |
| homecity-sky       | decorative backdrop                | 48x600  | Bottom-left, y 600, repeat x                     |
| neighbourhood-mid  | decorative backdrop                | 720x600 | Bottom-left, y 600, repeat x                     |
| neighbourhood-wall | decorative backdrop                | 48x180  | Bottom-left, y 600, repeat x                     |
| outskirts-mid      | decorative backdrop                | 720x600 | Bottom-left, y 600, repeat x                     |
| outskirts-wall     | decorative backdrop                | 48x144  | Bottom-left, y 600, repeat x                     |
| tiles-homecity     | tileset, 12px cells, eight columns | 96x48   | Four material families, seven terrain tiles each |

## Pebble pigeon

| Key               | Type                                | Size  | Tags                                                            |
| ----------------- | ----------------------------------- | ----- | --------------------------------------------------------------- |
| pigeon-antagonist | Pebble character; hit box 2,2,44,46 | 48x48 | idle, prepare, fly, drop, rest, frustration, swoop, prepare-air |
| pigeon-poop       | White projectile; hit box 0,0,12,12 | 12x12 | idle                                                            |

## Industrial materials

| Key                   | Type                               | Size    | Contract                                         |
| --------------------- | ---------------------------------- | ------- | ------------------------------------------------ |
| freight-gantry        | decorative backdrop                | 144x192 | Bottom-left, y 600, no repeat                    |
| freight-mid           | repeating backdrop                 | 720x600 | Bottom-left, y 600, repeat x                     |
| industrial-far        | repeating backdrop                 | 720x600 | Bottom-left, y 600, repeat x                     |
| industrial-sky        | repeating backdrop                 | 48x600  | Bottom-left, y 600, repeat x                     |
| tiles-industrial      | tileset, 12px cells, eight columns | 96x48   | Four material families, seven terrain tiles each |
| warehouse-loading-bay | decorative closed loading bay      | 120x144 | Bottom-left, y 600, no repeat                    |
| warehouse-mid         | repeating backdrop                 | 720x600 | Bottom-left, y 600, repeat x                     |
| warehouse-wall        | repeating backdrop                 | 48x240  | Bottom-left, y 600, repeat x                     |

## Raccoon antagonist

| Key                | Type                         | Size  | Tags                                                      |
| ------------------ | ---------------------------- | ----- | --------------------------------------------------------- |
| raccoon-antagonist | character; hit box 2,2,44,46 | 48x48 | idle, climb, prepare, drop, rest, frustration, walk, rush |

## Stage scenery variants

| Key                 | Type                                  | Size    | Contract                                    |
| ------------------- | ------------------------------------- | ------- | ------------------------------------------- |
| street-boundary-mid | repeating backdrop, low service roofs | 720x600 | Bottom-left y600, repeat x, middle distance |

## Stage scenery previews

Opaque actual stage captures, 168x84, registered as manifest images. Keys follow `stage-preview-zone-N-stage-M`; the first table identifies stages 1, 2 and 3 for Zones 1 through 5. Apartment uses the six floor keys listed below.

| Zone | Stage 1            | Stage 2       | Stage 3                |
| ---- | ------------------ | ------------- | ---------------------- |
| 1    | street             | city-streets  | city-boundary          |
| 2    | warehouse-district | loading-yards | freight-terminal       |
| 3    | farmland           | country-lanes | river-crossing         |
| 4    | forest-paths       | deep-woods    | ravine                 |
| 5    | city-outskirts     | back-streets  | familiar-neighbourhood |

| Apartment stage | Stage ID           |
| --------------- | ------------------ |
| 1               | lobby              |
| 2               | restaurant         |
| 3               | pool               |
| 4               | spa                |
| 5               | residential-floors |
| 6               | penthouse          |

## Woodland species and fauna

| Key                   | Type               | Size    | Contract                                     |
| --------------------- | ------------------ | ------- | -------------------------------------------- |
| background-deer       | decorative sprite  | 32x24   | idle 2x900ms, graze 4x300ms; loop, no hitbox |
| background-swallow    | decorative sprite  | 24x12   | flight 4x120ms; loop, no hitbox              |
| forest-mid-birch      | repeating backdrop | 720x600 | bottom-left y600, repeat x                   |
| forest-mid-conifers   | repeating backdrop | 720x600 | bottom-left y600, repeat x                   |
| woodland-far-birch    | repeating backdrop | 720x600 | bottom-left y600, repeat x                   |
| woodland-far-conifers | repeating backdrop | 720x600 | bottom-left y600, repeat x                   |

## Animated background flora

| Key              | Type              | Size  | Contract                      |
| ---------------- | ----------------- | ----- | ----------------------------- |
| background-reeds | decorative sprite | 24x24 | sway 4x300ms; loop, no hitbox |
