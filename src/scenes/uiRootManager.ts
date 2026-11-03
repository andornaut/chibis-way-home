import type { UiRegistration, UiRootHandle } from "@andornaut/game-kit/view/phaser/uiCommands";
import type { GameObjects, Scene } from "phaser";

interface UiRegistrar {
  register(roots: readonly GameObjects.GameObject[]): UiRegistration;
}
function members(roots: readonly GameObjects.GameObject[]): readonly GameObjects.GameObject[] {
  return roots.flatMap((root) => [
    root,
    ...("list" in root ? members(root.list as GameObjects.GameObject[]) : []),
  ]);
}

// A fallback restores the complete presentation domain, never just the newest modal.
export function createUiRootManager(recorder: UiRegistrar) {
  const groups = new Map<
    Scene,
    { handle: UiRootHandle; members: readonly GameObjects.GameObject[] }
  >();
  const clear = () => {
    for (const group of groups.values()) {
      group.handle.destroy();
    }
    groups.clear();
  };
  return {
    clear,
    owner(scene: Scene): object | undefined {
      return groups.get(scene)?.handle.owner;
    },
    sync(
      plans: readonly { scene: Scene; roots: readonly GameObjects.GameObject[] | undefined }[],
    ): boolean {
      const present = new Set(plans.map(({ scene }) => scene));
      for (const [scene, group] of groups) {
        if (!present.has(scene)) {
          group.handle.destroy();
          groups.delete(scene);
        }
      }
      for (const { roots, scene } of plans) {
        if (!roots) {
          clear();
          return false;
        }
        const next = members(roots),
          current = groups.get(scene);
        if (
          current &&
          current.members.length === next.length &&
          current.members.every((object, index) => object === next[index])
        ) {
          continue;
        }
        if (current) {
          const refreshed = current.handle.refresh(roots);
          if (refreshed.status !== "ready") {
            clear();
            return false;
          }
          current.members = next;
        } else if (roots.length) {
          const result = recorder.register(roots);
          if (result.status !== "ready") {
            clear();
            return false;
          }
          groups.set(scene, { handle: result.handle, members: next });
        }
      }
      return true;
    },
  };
}
