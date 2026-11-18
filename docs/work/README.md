# Work items

Each approved task is one file, `docs/work/<id>.md`. It records scope and milestones; live
progress (claims, blocks, receipts and acceptance) stays in the work protocol state root. The
[design index](../design/README.md) lists the work items of each area.

| Front matter | Content                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| `id`         | `cwh-` and a zero-padded sequence (`cwh-0001`), allocated in chronological order. |
| `title`      | A short imperative title.                                                         |
| `status`     | `approved`, `done`, `cancelled` or `superseded`.                                  |
| `approved`   | A short approval reference, such as `user, 2026-11-18`.                           |
| `design`     | The design area in `docs/design/`.                                                |
| `related`    | A list of related work IDs.                                                       |
| `supersedes` | The ID of the item this one replaces; omitted otherwise.                          |

The sections are Scope, Criteria, Decisions and Outcome. Decisions and Outcome state what was
decided or delivered, and why, in a line or two each.

- Only `main` edits design index tables and approved scope. Approval commits the work-file stub
  and its index row on `main`, and that commit allocates the ID.
- Workers edit only their own work file and the design prose that ships with their feature.
  Integration sets `status: done` in the merge.
- A changed or reverted decision is a new work item with `supersedes`. A finished item's outcome
  is never rewritten.
- Work files are public: no session IDs, hostnames, local home-directory paths or quoted
  conversation, only short approval references.
- An approval reference ending in `backfill` dates a finished item by its first implementing
  commit.
- Docs-only changes run only the attribution and lint checks ([cwh-0026](cwh-0026.md)).
- The game never serves or deploys `docs/`: the build reads `pages/` and `public/`, and
  deployment uploads only `dist/`.

## Index

| ID       | Title                                                                     | Link                       |
| -------- | ------------------------------------------------------------------------- | -------------------------- |
| cwh-0001 | Serve the site as static pages with per-page security headers             | [cwh-0001.md](cwh-0001.md) |
| cwh-0002 | Show the shared crash screen on an uncaught error                         | [cwh-0002.md](cwh-0002.md) |
| cwh-0003 | Play offline from a per-build service worker cache                        | [cwh-0003.md](cwh-0003.md) |
| cwh-0004 | Offer updates and require one for a newer save                            | [cwh-0004.md](cwh-0004.md) |
| cwh-0005 | Install the game as a full-screen landscape app                           | [cwh-0005.md](cwh-0005.md) |
| cwh-0006 | Bundle a reduced WebGL-only Phaser build                                  | [cwh-0006.md](cwh-0006.md) |
| cwh-0007 | Pack art into content-hashed lossless WebP atlas pages                    | [cwh-0007.md](cwh-0007.md) |
| cwh-0008 | Turn the page frame to landscape on portrait touch screens                | [cwh-0008.md](cwh-0008.md) |
| cwh-0009 | Isolate modal input and dim frozen backdrops through game-kit             | [cwh-0009.md](cwh-0009.md) |
| cwh-0010 | Add browser developer controls with run-only cheats                       | [cwh-0010.md](cwh-0010.md) |
| cwh-0011 | Consume the shared kits as pinned published releases                      | [cwh-0011.md](cwh-0011.md) |
| cwh-0012 | Run checks in isolated, load-admitted containers                          | [cwh-0012.md](cwh-0012.md) |
| cwh-0013 | Run boss behaviour as perceive, decide and act                            | [cwh-0013.md](cwh-0013.md) |
| cwh-0014 | Layer the source into components behind a Phaser boundary                 | [cwh-0014.md](cwh-0014.md) |
| cwh-0015 | Ship local main through delivery-kit departures                           | [cwh-0015.md](cwh-0015.md) |
| cwh-0016 | Move the interface to an HTML UI layer                                    | [cwh-0016.md](cwh-0016.md) |
| cwh-0017 | Show the loading strip only for awaited loads                             | [cwh-0017.md](cwh-0017.md) |
| cwh-0018 | Retry a failed first offline installation through the shared Retry        | [cwh-0018.md](cwh-0018.md) |
| cwh-0019 | Dim and isolate covered modal chrome under strict top-dialog isolation    | [cwh-0019.md](cwh-0019.md) |
| cwh-0020 | Route discrete actions through the shared hold binding                    | [cwh-0020.md](cwh-0020.md) |
| cwh-0021 | Pin delivery-kit 4.6.1                                                    | [cwh-0021.md](cwh-0021.md) |
| cwh-0022 | Set discrete control holds to 500 ms                                      | [cwh-0022.md](cwh-0022.md) |
| cwh-0023 | Draw the loading failure Retry on the primary plate                       | [cwh-0023.md](cwh-0023.md) |
| cwh-0024 | Size modal cards by width family                                          | [cwh-0024.md](cwh-0024.md) |
| cwh-0025 | Accept the 0.56.1 build in the browser after deployment                   | [cwh-0025.md](cwh-0025.md) |
| cwh-0026 | Run only lint and attribution checks for docs-only changes                | [cwh-0026.md](cwh-0026.md) |
| cwh-0027 | Adopt design and work files                                               | [cwh-0027.md](cwh-0027.md) |
| cwh-0028 | Write the pitch, setting and story                                        | [cwh-0028.md](cwh-0028.md) |
| cwh-0029 | Tune Chibi's movement to the grid reaches                                 | [cwh-0029.md](cwh-0029.md) |
| cwh-0030 | Set the touch, keyboard and mouse controls                                | [cwh-0030.md](cwh-0030.md) |
| cwh-0031 | Present conversations in a top dialogue box                               | [cwh-0031.md](cwh-0031.md) |
| cwh-0032 | Add the start screen, pause card and settings card                        | [cwh-0032.md](cwh-0032.md) |
| cwh-0033 | Put optional rooms behind doors                                           | [cwh-0033.md](cwh-0033.md) |
| cwh-0034 | Assemble stages from seeded hand-designed chunks                          | [cwh-0034.md](cwh-0034.md) |
| cwh-0035 | Travel a linear map of zones with saved progress                          | [cwh-0035.md](cwh-0035.md) |
| cwh-0036 | Mark lethal surfaces with red edges                                       | [cwh-0036.md](cwh-0036.md) |
| cwh-0037 | Build the V1 route from the parcel depot through the five outdoor zones   | [cwh-0037.md](cwh-0037.md) |
| cwh-0038 | Show the death sequence and retry card                                    | [cwh-0038.md](cwh-0038.md) |
| cwh-0039 | Name the game and its cast                                                | [cwh-0039.md](cwh-0039.md) |
| cwh-0040 | Give each antagonist tells, a special and persistent pursuit              | [cwh-0040.md](cwh-0040.md) |
| cwh-0041 | Track runs, attempts and stage statistics                                 | [cwh-0041.md](cwh-0041.md) |
| cwh-0042 | Write zone introductions, outgoing exchanges and barks                    | [cwh-0042.md](cwh-0042.md) |
| cwh-0043 | Vary required challenges under stage design principles                    | [cwh-0043.md](cwh-0043.md) |
| cwh-0044 | Build Apartment as six upward floors                                      | [cwh-0044.md](cwh-0044.md) |
| cwh-0045 | Play a storybook opening before new games                                 | [cwh-0045.md](cwh-0045.md) |
| cwh-0046 | Add Dash, Double jump and Speedy as gifted skills                         | [cwh-0046.md](cwh-0046.md) |
| cwh-0047 | Add transfer gates, warned vents and crumbling supports                   | [cwh-0047.md](cwh-0047.md) |
| cwh-0048 | Defer Pebble's targeted attacks during forced transit                     | [cwh-0048.md](cwh-0048.md) |
| cwh-0049 | Add the 26 achievements                                                   | [cwh-0049.md](cwh-0049.md) |
| cwh-0050 | Make bosses an annoyance, not a fight                                     | [cwh-0050.md](cwh-0050.md) |
| cwh-0051 | Give each zone a signature obstacle                                       | [cwh-0051.md](cwh-0051.md) |
| cwh-0052 | Hold one designed arena per encounter stage                               | [cwh-0052.md](cwh-0052.md) |
| cwh-0053 | Add Reduced motion and offer Install in every browser                     | [cwh-0053.md](cwh-0053.md) |
| cwh-0054 | Add the Accessible interface rule                                         | [cwh-0054.md](cwh-0054.md) |
| cwh-0055 | Keep the HUD visible through dialogue and dim it where inert              | [cwh-0055.md](cwh-0055.md) |
| cwh-0056 | Place the touch controls at the control insets inside the view            | [cwh-0056.md](cwh-0056.md) |
| cwh-0057 | Show the touch controls' icons, states and notes in Settings              | [cwh-0057.md](cwh-0057.md) |
| cwh-0058 | Show stage progress horizontally and keep zone visit stats hidden         | [cwh-0058.md](cwh-0058.md) |
| cwh-0059 | Describe the opening as shipped and settle Fert's wording                 | [cwh-0059.md](cwh-0059.md) |
| cwh-0060 | Grant skills unselected and tip the player to enable them                 | [cwh-0060.md](cwh-0060.md) |
| cwh-0061 | Give Restart a close X and focus the primary action first                 | [cwh-0061.md](cwh-0061.md) |
| cwh-0062 | Re-offer a waiting update on every start-screen arrival                   | [cwh-0062.md](cwh-0062.md) |
| cwh-0063 | Move the remaining screens to the HTML UI                                 | [cwh-0063.md](cwh-0063.md) |
| cwh-0064 | Target 125 distinct layouts per zone                                      | [cwh-0064.md](cwh-0064.md) |
| cwh-0065 | Admit ordinary-qualified layouts for Industrial, Countryside and Woodland | [cwh-0065.md](cwh-0065.md) |
| cwh-0066 | Open Pause or Menu from one shared entry                                  | [cwh-0066.md](cwh-0066.md) |
| cwh-0067 | Place the primary action last in action rows                              | [cwh-0067.md](cwh-0067.md) |
| cwh-0068 | Divide stage statistics from the Stage, Zone and Run totals               | [cwh-0068.md](cwh-0068.md) |
| cwh-0069 | Prefix the touch settings rows with Display                               | [cwh-0069.md](cwh-0069.md) |
| cwh-0070 | Auto-select the first gifted skill                                        | [cwh-0070.md](cwh-0070.md) |
| cwh-0071 | Keep the opening at four still shots                                      | [cwh-0071.md](cwh-0071.md) |
| cwh-0072 | Aim for at least 16 ordinary layouts in every zone                        | [cwh-0072.md](cwh-0072.md) |
| cwh-0073 | Qualify more Blue city layouts                                            | [cwh-0073.md](cwh-0073.md) |
| cwh-0074 | Finish only the started Blue and Woodland layout work                     | [cwh-0074.md](cwh-0074.md) |
