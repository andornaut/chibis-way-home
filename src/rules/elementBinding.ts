import type { ElementBinding, Instance, Tuning } from "../data/types/index.ts";

function overlayTuning(base: Tuning | undefined, binding: Tuning): Tuning {
  return {
    ...(base?.interaction || binding.interaction
      ? { interaction: { ...base?.interaction, ...binding.interaction } }
      : {}),
    ...(base?.motion || binding.motion ? { motion: { ...base?.motion, ...binding.motion } } : {}),
    ...(base?.reaction || binding.reaction
      ? { reaction: { ...base?.reaction, ...binding.reaction } }
      : {}),
  };
}

// All element categories share the same configuration overlay. Placement and conditions remain
// properties of the template instance; a binding cannot replace them.
export function bindElement(
  bindings: Readonly<Record<string, ElementBinding>>,
  instance: Instance,
): Instance {
  if (instance.role === undefined) {
    return instance;
  }
  const binding = Object.hasOwn(bindings, instance.role) ? bindings[instance.role] : undefined;
  if (!binding) {
    throw new Error(`No binding for role ${instance.role}`);
  }
  const resolved = { ...instance, character: binding.character };
  for (const key of ["behaviour", "lines", "parallax", "phase", "skin"] as const) {
    if (binding[key] !== undefined) {
      Object.assign(resolved, { [key]: binding[key] });
    }
  }
  if (binding.overrides !== undefined) {
    resolved.overrides = overlayTuning(instance.overrides, binding.overrides);
  }
  if (binding.scene === null) {
    delete resolved.scene;
  } else if (binding.scene !== undefined) {
    resolved.scene = binding.scene;
  }
  return resolved;
}
