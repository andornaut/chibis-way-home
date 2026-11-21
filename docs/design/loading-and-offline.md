# Loading and offline

The page's first module installs game-kit's crash screen before the loading strip, Phaser or any
game module runs. A two-pixel loading strip at the top shows only loads the player waits for and
stays painted and dimmed under modals. Game-kit's launch installs the complete, verified build under
that strip before play, with one determinate value, so the game then plays offline through the
router `/sw.js`; a failed first install shows game-kit's loading failure with Retry on the primary
plate. A device that cannot install, because service workers cannot register or storage is full,
plays from the network with a one-line notice on the first screen, and the next launch tries the
install again. An install keeps only the sound format the device plays; the game has no sound, so
every listed file installs. A staged update switches silently at the next launch, or through an
Update now card over any screen that saves first; a dismissed card does not return that session. A
save from a newer version requires the update before any save write. The home page and Settings
offer Install in every browser until the game is installed, and back is caught with a CloseWatcher
or a guard history entry.

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
| cwh-0266 | Adopt the game-kit 0.59 install and update loader                  | [cwh-0266.md](../work/cwh-0266.md) |
