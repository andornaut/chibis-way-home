import type { ZoneState } from "../rules/zone";

interface WitnessNode {
  local: bigint;
  mask: bigint;
  parent?: WitnessNode;
  version: number;
}

// Witnesses belong to immutable engine prefixes, including shared cached transitions.
export class WalkWitnesses {
  private readonly nodes = new WeakMap<ZoneState, WitnessNode>();
  private readonly terminals = new Set<WitnessNode>();
  private readonly tokens = new Map<string, bigint>();
  private full = 0n;
  private version = 0;

  token(key: string): bigint {
    let token = this.tokens.get(key);
    if (token === undefined) {
      token = 1n << BigInt(this.tokens.size);
      this.tokens.set(key, token);
      this.full |= token;
    }
    return token;
  }

  get size(): number {
    return this.tokens.size;
  }

  surface(key: string): bigint {
    return this.tokens.get(`surface:${key}`) ?? 0n;
  }

  transition(before: ZoneState, next: ZoneState): void {
    if (next !== before && !this.nodes.has(next)) {
      this.nodes.set(next, { local: 0n, mask: 0n, parent: this.node(before), version: -1 });
    }
  }

  mark(state: ZoneState, token: bigint): void {
    if (token !== 0n && (this.profile(state) & token) !== token) {
      this.node(state).local |= token;
      this.version++;
    }
  }

  profile(state: ZoneState): bigint {
    return this.mask(this.node(state));
  }

  ready(state: ZoneState): boolean {
    return (this.profile(state) & this.full) === this.full;
  }

  finish(state: ZoneState): void {
    this.terminals.add(this.node(state));
  }

  complete(): boolean {
    return [...this.terminals].some((node) => (this.mask(node) & this.full) === this.full);
  }

  private node(state: ZoneState): WitnessNode {
    let node = this.nodes.get(state);
    if (!node) {
      node = { local: 0n, mask: 0n, version: -1 };
      this.nodes.set(state, node);
    }
    return node;
  }

  private mask(node: WitnessNode): bigint {
    const pending: WitnessNode[] = [];
    let current: WitnessNode | undefined = node;
    while (current && current.version !== this.version) {
      pending.push(current);
      current = current.parent;
    }
    let mask = current?.mask ?? 0n;
    for (const next of pending.reverse()) {
      mask |= next.local;
      next.mask = mask;
      next.version = this.version;
    }
    return mask;
  }
}
