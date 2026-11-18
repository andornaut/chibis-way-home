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

| ID       | Title                                                                  | Link                       |
| -------- | ---------------------------------------------------------------------- | -------------------------- |
| cwh-0001 | Serve the site as static pages with per-page security headers          | [cwh-0001.md](cwh-0001.md) |
| cwh-0002 | Show the shared crash screen on an uncaught error                      | [cwh-0002.md](cwh-0002.md) |
| cwh-0003 | Play offline from a per-build service worker cache                     | [cwh-0003.md](cwh-0003.md) |
| cwh-0004 | Offer updates and require one for a newer save                         | [cwh-0004.md](cwh-0004.md) |
| cwh-0005 | Install the game as a full-screen landscape app                        | [cwh-0005.md](cwh-0005.md) |
| cwh-0006 | Bundle a reduced WebGL-only Phaser build                               | [cwh-0006.md](cwh-0006.md) |
| cwh-0007 | Pack art into content-hashed lossless WebP atlas pages                 | [cwh-0007.md](cwh-0007.md) |
| cwh-0008 | Turn the page frame to landscape on portrait touch screens             | [cwh-0008.md](cwh-0008.md) |
| cwh-0009 | Isolate modal input and dim frozen backdrops through game-kit          | [cwh-0009.md](cwh-0009.md) |
| cwh-0010 | Add browser developer controls with run-only cheats                    | [cwh-0010.md](cwh-0010.md) |
| cwh-0011 | Consume the shared kits as pinned published releases                   | [cwh-0011.md](cwh-0011.md) |
| cwh-0012 | Run checks in isolated, load-admitted containers                       | [cwh-0012.md](cwh-0012.md) |
| cwh-0013 | Run boss behaviour as perceive, decide and act                         | [cwh-0013.md](cwh-0013.md) |
| cwh-0014 | Layer the source into components behind a Phaser boundary              | [cwh-0014.md](cwh-0014.md) |
| cwh-0015 | Ship local main through delivery-kit departures                        | [cwh-0015.md](cwh-0015.md) |
| cwh-0016 | Move the interface to an HTML UI layer                                 | [cwh-0016.md](cwh-0016.md) |
| cwh-0017 | Show the loading strip only for awaited loads                          | [cwh-0017.md](cwh-0017.md) |
| cwh-0018 | Retry a failed first offline installation through the shared Retry     | [cwh-0018.md](cwh-0018.md) |
| cwh-0019 | Dim and isolate covered modal chrome under strict top-dialog isolation | [cwh-0019.md](cwh-0019.md) |
| cwh-0020 | Route discrete actions through the shared hold binding                 | [cwh-0020.md](cwh-0020.md) |
| cwh-0021 | Pin delivery-kit 4.6.1                                                 | [cwh-0021.md](cwh-0021.md) |
| cwh-0022 | Set discrete control holds to 500 ms                                   | [cwh-0022.md](cwh-0022.md) |
| cwh-0023 | Draw the loading failure Retry on the primary plate                    | [cwh-0023.md](cwh-0023.md) |
| cwh-0024 | Size modal cards by width family                                       | [cwh-0024.md](cwh-0024.md) |
| cwh-0025 | Accept the 0.56.1 build in the browser after deployment                | [cwh-0025.md](cwh-0025.md) |
| cwh-0026 | Run only lint and attribution checks for docs-only changes             | [cwh-0026.md](cwh-0026.md) |
| cwh-0027 | Adopt design and work files                                            | [cwh-0027.md](cwh-0027.md) |
