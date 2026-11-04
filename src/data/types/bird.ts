// Chibi: his movement, skills and death tuning.

import type { Point, Rect } from "./geometry";

export type DeathReason = "crush" | "fall" | "hazard";

export type DeathContact =
  | { readonly contactCue?: "red-hazard"; readonly index: number; readonly kind: "object" }
  | {
      readonly contactCue?: "red-hazard";
      readonly emitter: number;
      readonly id: number;
      readonly kind: "transient";
    };

// A frozen contact snapshot. Position is the bird body's top-left; support is the nearest
// frozen solid or ledge below the body, or undefined over a void.
export interface ZoneDeath {
  readonly contact?: DeathContact;
  readonly position: Point;
  readonly reason: DeathReason;
  readonly support: Rect | undefined;
  readonly velocity: Point;
}

// Death-camera travel uses pixels/second, with its duration bounded in seconds.
export interface DeathCameraPanTuning {
  // Logical pixels below the full sprite frame in the final presentation.
  readonly bottomInset: number;
  readonly maxSeconds: number;
  readonly minSeconds: number;
  readonly pixelsPerSecond: number;
}

// Death presentation values use pixels and seconds. Recoil x is relative to facing.
export interface DeathTuning {
  readonly bounceSpeed: number;
  readonly cameraPan: DeathCameraPanTuning;
  readonly fallGravity: number;
  readonly impactSeconds: number;
  readonly maxFallSpeed: number;
  readonly recoilSeconds: number;
  readonly recoilVelocity: Point;
  readonly voidFallDistance: number;
}

// A finite horizontal burst: speed in pixels/second, durations in active-play seconds.
export interface BirdDashTuning {
  readonly cooldownSeconds: number;
  readonly durationSeconds: number;
  readonly speed: number;
}

// The bird's movement, in base pixels and seconds.
// Dash wind is visual only. Distances are full sprite-frame pixels; alpha is 0..1.
export interface DashTrailLine {
  readonly alpha: number;
  // A named key in the art palette's colours map.
  readonly colour: string;
  readonly gap: number;
  readonly length: number;
  readonly y: number;
}

export interface DashTrailTuning {
  readonly borderColour: string;
  // Logical pixels around the core; line gaps stop at the outer border and y names the core top.
  readonly borderThickness: number;
  readonly headColumns: number;
  readonly headDecay: number;
  readonly lengthDecay: number;
  readonly lines: readonly DashTrailLine[];
  readonly thickness: number;
  readonly tipFadeExponent: number;
}

// Visual-only second-jump cue. Offset uses the current full frame centre, in logical pixels.
export interface AirJumpCueTuning {
  readonly borderColour: string;
  // Logical pixels around the scaled glyph.
  readonly borderThickness: number;
  readonly colour: string;
  readonly durationSeconds: number;
  // Horizontal lead follows actual velocity; a stationary bird receives no lead.
  readonly forwardLead: number;
  readonly offset: Point;
  readonly scale: number;
}

export interface BirdTuning {
  readonly dash?: BirdDashTuning;
  // Enables one fresh airborne jump per airtime; only actual supported landing restores it.
  readonly doubleJump?: boolean;
  readonly doubleJumpHeightRatio: number;
  // Speed gained per second while a direction is held, on the ground and in the air.
  readonly airAccel: number;
  readonly groundAccel: number;
  // Neutral-input deceleration on the ground and in the air.
  readonly brakeAccel: number;
  // Seconds after walking off a ledge in which a jump still starts.
  readonly coyoteTime: number;
  // Fastest fall: every fall flutters.
  readonly flutterFallSpeed: number;
  readonly gravity: number;
  // Her collision box.
  readonly height: number;
  readonly width: number;
  // Seconds before landing in which a jump press is kept, to start as she lands.
  readonly jumpBuffer: number;
  // Height of the low hop, including releases during the tap window.
  readonly jumpHopHeight: number;
  // Seconds to the full-jump apex under constant ascent gravity.
  readonly jumpRiseTime: number;
  // Seconds after the tap window over which releasing retains more upward speed.
  readonly jumpReleaseBlendTime: number;
  // Defines the existing full-jump height: speed squared divided by twice gravity.
  readonly jumpSpeed: number;
  // Seconds of forgiving low-hop input before releasing retains extra upward speed.
  readonly jumpTapWindow: number;
  readonly walkSpeed: number;
}

export type SkillId = "dash" | "doubleJump" | "speedy";

export interface SkillGestureTuning {
  readonly holdMilliseconds: number;
}

export interface SkillTuning {
  readonly speedyWalkMultiplier: number;
}

export interface SkillOwnership {
  readonly skills: readonly SkillId[];
}

export interface SkillSelection extends SkillOwnership {
  readonly activeSkill: SkillId | null;
}
