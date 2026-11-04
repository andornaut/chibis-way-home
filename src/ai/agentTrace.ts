// Structured per-tick records of pursuing agents and their target, for simulations and checks.

export interface TracePoint {
  readonly x: number;
  readonly y: number;
}

export interface TraceBody {
  readonly at: TracePoint;
  readonly height: number;
  readonly width: number;
}

// One attack sequence: its warning tell, then its committed action and recovery.
export interface TraceAttack {
  readonly id: string;
  readonly phase: "committed" | "tell";
}

export interface AgentSample extends TraceBody {
  readonly attack?: TraceAttack;
  readonly cooldownSeconds?: number;
  readonly facing: -1 | 1;
  // The contact box's bottom rests on a present support top over part of its width.
  readonly footing: boolean;
  readonly id: string;
  // What the agent is, such as its character; properties select their data by it.
  readonly kind: string;
  readonly motion: string;
  readonly pursuit?: "engaged" | "escaped";
  readonly state: string;
  // Ordinary support contact at the end of the tick: a clear body whose feet rest on a present
  // support under part of its hitbox.
  readonly supported: boolean;
}

export interface TargetSample extends TraceBody {
  readonly grounded: boolean;
  readonly velocity: TracePoint;
}

export interface AgentTick<World = unknown> {
  readonly agents: readonly AgentSample[];
  // Restarts after a failure start a new episode; durations never span episodes.
  readonly episode: number;
  // Why the episode ended this tick, if it did.
  readonly failure?: string;
  readonly seconds: number;
  readonly target: TargetSample;
  readonly tick: number;
  readonly world: World;
}

export function centre(body: TraceBody): TracePoint {
  return { x: body.at.x + body.width / 2, y: body.at.y + body.height / 2 };
}
