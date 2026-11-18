# Loading and offline

The page's first module installs game-kit's crash screen before the loading strip, Phaser or any
game module runs. A two-pixel loading strip at the top shows only loads the player waits for and
stays painted and dimmed under modals. Each build writes `/sw.js` with its own cache of `/play/`,
its resources and atlas pages, so the game plays offline; a failed first offline installation
shows game-kit's loading failure with Retry on the primary plate. A fresh document applies a
complete waiting build, a dismissed update offer returns on the next start-screen arrival, and a save
from a newer version requires the update before any save write. The home page and Settings offer
Install in every browser until the game is installed, and back is caught with a CloseWatcher or a
guard history entry.

Reference: [assets and build](../../src/README.md#assets-and-build),
[phone](../../src/README.md#phone).

## Work items

| ID       | Title                                                              | Link                               |
| -------- | ------------------------------------------------------------------ | ---------------------------------- |
| cwh-0002 | Show the shared crash screen on an uncaught error                  | [cwh-0002.md](../work/cwh-0002.md) |
| cwh-0003 | Play offline from a per-build service worker cache                 | [cwh-0003.md](../work/cwh-0003.md) |
| cwh-0004 | Offer updates and require one for a newer save                     | [cwh-0004.md](../work/cwh-0004.md) |
| cwh-0005 | Install the game as a full-screen landscape app                    | [cwh-0005.md](../work/cwh-0005.md) |
| cwh-0017 | Show the loading strip only for awaited loads                      | [cwh-0017.md](../work/cwh-0017.md) |
| cwh-0018 | Retry a failed first offline installation through the shared Retry | [cwh-0018.md](../work/cwh-0018.md) |
