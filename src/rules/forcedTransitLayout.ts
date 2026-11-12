import type {
  ForcedTransit,
  ForcedTransitInterval,
  ForcedTransitLayout,
  ForcedTransitLayoutOriginWindow,
  ForcedTransitTileOriginWindow,
  Instance,
  ObjectLayout,
  Point,
} from "../data/types/index.ts";

function identifier(value: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/.test(value)) {
    throw new Error("Invalid forced-transit identifier");
  }
}

function interval(
  tile: number,
  offset: number,
  value: ForcedTransitInterval,
): ForcedTransitInterval {
  if (value.length !== 2 || !value.every(Number.isFinite) || value[0] > value[1]) {
    throw new Error("Invalid forced-transit interval");
  }
  const resolved = [offset + tile * value[0], offset + tile * value[1]] as const;
  if (!resolved.every(Number.isFinite)) {
    throw new Error("Invalid resolved forced-transit interval");
  }
  return resolved;
}

function originWindow(
  tile: number,
  origin: Point,
  value: ForcedTransitTileOriginWindow,
): ForcedTransitLayoutOriginWindow {
  return { x: interval(tile, origin.x, value.col), y: interval(tile, origin.y, value.row) };
}

export function resolveForcedTransit(
  tile: number,
  origin: Point,
  transit: ForcedTransit,
): ForcedTransitLayout {
  if (!Number.isFinite(tile) || tile <= 0 || ![origin.x, origin.y].every(Number.isFinite)) {
    throw new Error("Invalid forced-transit coordinate frame");
  }
  identifier(transit.group);
  identifier(transit.leg);
  const ids = new Set<string>();
  const banks = transit.banks.map((bank) => {
    identifier(bank.id);
    if (
      ids.has(bank.id) ||
      !["forward", "refuge", "retreat"].includes(bank.purpose) ||
      ![bank.col, bank.cols, bank.row].every(Number.isFinite) ||
      bank.cols <= 0
    ) {
      throw new Error("Invalid forced-transit bank");
    }
    ids.add(bank.id);
    const resolved = {
      id: bank.id,
      purpose: bank.purpose,
      width: bank.cols * tile,
      x: origin.x + bank.col * tile,
      y: origin.y + bank.row * tile,
    };
    if (![resolved.x, resolved.y, resolved.width].every(Number.isFinite)) {
      throw new Error("Invalid resolved forced-transit bank");
    }
    return resolved;
  });
  if (
    transit.boardingBanks.length === 0 ||
    new Set(transit.boardingBanks).size !== transit.boardingBanks.length ||
    transit.boardingBanks.some((id) => !ids.has(id))
  ) {
    throw new Error("Invalid forced-transit boarding bank references");
  }
  const windows = transit.windows.map((window) => {
    if (
      !["uncertified", "ordinary"].includes(window.certification) ||
      (window.result.kind !== "forced" && window.result.kind !== "egress") ||
      (window.result.kind === "egress" && !ids.has(window.result.bankId))
    ) {
      throw new Error("Invalid forced-transit window result");
    }
    return {
      certification: window.certification,
      result: { ...window.result },
      riderOnSupport: originWindow(tile, { x: 0, y: 0 }, window.riderOnSupport),
      supportOrigin: originWindow(tile, origin, window.supportOrigin),
    };
  });
  return {
    banks,
    boardingBanks: [...transit.boardingBanks],
    group: transit.group,
    leg: transit.leg,
    windows,
  };
}

export function namespaceForcedTransit(scope: string, instances: readonly Instance[]): Instance[] {
  identifier(scope);
  return instances.map((instance) => {
    if (!instance.forcedTransit) {
      return instance;
    }
    identifier(instance.forcedTransit.group);
    return {
      ...instance,
      forcedTransit: {
        ...instance.forcedTransit,
        group: `${scope}:${instance.forcedTransit.group}`,
      },
    };
  });
}

export function validateForcedTransitGroups(objects: readonly ObjectLayout[]): void {
  const groups = new Map<
    string,
    Map<string, { readonly width: number; readonly x: number; readonly y: number }>
  >();
  for (const object of objects) {
    const transit = object.forcedTransit;
    if (!transit) {
      continue;
    }
    let banks = groups.get(transit.group);
    if (!banks) {
      banks = new Map();
      groups.set(transit.group, banks);
    }
    for (const bank of transit.banks) {
      const prior = banks.get(bank.id);
      if (prior && (prior.x !== bank.x || prior.y !== bank.y || prior.width !== bank.width)) {
        throw new Error("Conflicting forced-transit group bank geometry");
      }
      banks.set(bank.id, bank);
    }
  }
}
