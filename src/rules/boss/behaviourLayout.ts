import type {
  BehaviourAction,
  BehaviourCondition,
  BehaviourPlan,
  Point,
  SecondsRange,
} from "../../data/types/index.ts";

// Resolve a complete graph once; malformed transitions fail before a stage starts.
export function layoutBehaviour(tile: number, plan: BehaviourPlan): BehaviourPlan {
  const valid = (value: number) => Number.isFinite(value) && value >= 0;
  const validRange = ({ max, min }: SecondsRange) => valid(min) && valid(max) && min <= max;
  if (!Number.isFinite(plan.distance) || !plan.states[plan.initial]) {
    throw new Error("Invalid behaviour extent or initial state");
  }
  if (plan.facing !== undefined && plan.facing !== -1 && plan.facing !== 1) {
    throw new Error("Invalid behaviour facing");
  }
  if (
    plan.pursuit &&
    (!valid(plan.pursuit.distance) ||
      plan.pursuit.distance === 0 ||
      (plan.pursuit.unreachableGraceSeconds !== null &&
        !valid(plan.pursuit.unreachableGraceSeconds)) ||
      (plan.pursuit.escapeDistance !== undefined && !valid(plan.pursuit.escapeDistance)) ||
      (plan.pursuit.pace &&
        (![plan.pursuit.pace.distance, plan.pursuit.pace.speed].every(
          (value) => Number.isFinite(value) && value > 0,
        ) ||
          !validRange(plan.pursuit.pace.pauseSeconds))) ||
      (plan.pursuit.rearmSeconds !== undefined && !valid(plan.pursuit.rearmSeconds)) ||
      (plan.pursuit.screen &&
        (!valid(plan.pursuit.screen.margin) ||
          !(plan.pursuit.screen.width > 2 * plan.pursuit.screen.margin))) ||
      (plan.pursuit.relief &&
        (!plan.scorer ||
          !validRange(plan.pursuit.relief.pause.afterSeconds) ||
          !validRange(plan.pursuit.relief.pause.seconds) ||
          !valid(plan.pursuit.relief.pause.tellClearanceSeconds) ||
          !validRange(plan.pursuit.relief.giveUp.seconds))) ||
      !plan.pursuit.escaped.line ||
      !plan.pursuit.escaped.speaker)
  ) {
    throw new Error("Invalid pursuit configuration");
  }
  const wander = plan.wander;
  if (
    wander &&
    (!validRange(wander.everySeconds) ||
      !validRange(wander.holdSeconds) ||
      !(wander.range > 0) ||
      (wander.walk === undefined) === (wander.hop === undefined) ||
      (wander.walk &&
        (!validRange(wander.walk.distance) ||
          !(wander.walk.distance.min > 0) ||
          !(wander.walk.speed > 0))) ||
      (wander.hop !== undefined &&
        (plan.states[wander.hop]?.motion.kind !== "fly" ||
          !plan.states[wander.hop]!.transitions.some(
            ({ to }) => plan.states[to]?.motion.kind === "wait",
          ))))
  ) {
    throw new Error("Invalid wander");
  }
  if (plan.attackCooldownSeconds !== undefined && !valid(plan.attackCooldownSeconds)) {
    throw new Error("Invalid attack cooldown");
  }
  const tellPause = plan.tellCancelPause;
  if (
    tellPause &&
    (plan.attackCooldownSeconds === undefined ||
      !Number.isSafeInteger(tellPause.cancels) ||
      tellPause.cancels <= 0 ||
      !valid(tellPause.seconds))
  ) {
    throw new Error("Invalid tell cancel pause");
  }
  const watchdog = plan.idleWatchdog;
  if (
    watchdog &&
    (!plan.pursuit ||
      ![watchdog.seconds, watchdog.minMovement, watchdog.distance].every(
        (value) => Number.isFinite(value) && value > 0,
      ) ||
      !Number.isInteger(watchdog.maxAttempts) ||
      watchdog.maxAttempts <= 0 ||
      plan.states[watchdog.resume]?.motion.kind !== "pursue" ||
      (plan.states[watchdog.resume]?.onEnter?.length ?? 0) > 0)
  ) {
    throw new Error("Invalid idle watchdog configuration");
  }
  const scorer = plan.scorer;
  if (scorer) {
    const engaged = plan.states[scorer.engaged];
    const ids = scorer.moves.map(({ id }) => id);
    const curves = [
      ...scorer.moves.flatMap(({ considerations }) => considerations),
      ...Object.values(plan.states).flatMap(({ transitions }) =>
        transitions.flatMap(({ score }) => score?.considerations ?? []),
      ),
    ];
    if (
      !plan.pursuit ||
      engaged?.motion.kind !== "pursue" ||
      engaged.attack ||
      engaged.onEnter?.length ||
      scorer.moves.length === 0 ||
      new Set(ids).size !== ids.length ||
      !(
        scorer.decisionSeconds.min > 0 && scorer.decisionSeconds.min <= scorer.decisionSeconds.max
      ) ||
      !(scorer.due.anySeconds > 0 && scorer.due.specialSeconds > 0) ||
      !valid(scorer.due.openingSpecialSeconds) ||
      ![
        scorer.due.weight,
        scorer.hysteresis.bonus,
        scorer.hysteresis.epsilon,
        scorer.hysteresis.minHoldSeconds,
        scorer.pressure.graceSeconds,
        scorer.pressure.rampSeconds,
        scorer.pressure.weight,
        ...scorer.moves.map(({ base }) => base),
      ].every(valid) ||
      !curves.every(({ curve }) => Number.isFinite(curve.from) && Number.isFinite(curve.to)) ||
      !scorer.moves.every(
        ({ move }) =>
          move.kind === "chase" ||
          (move.kind === "cut-off"
            ? valid(move.leadSeconds) && valid(move.maxLead)
            : valid(move.distance)),
      )
    ) {
      throw new Error("Invalid boss scorer");
    }
  }
  // Spatial scorer inputs scale to pixels with their curve ranges; seconds and sight do not.
  const spatial = new Set(["distance", "heightDelta", "heightGap", "horizontalGap", "targetSpeed"]);
  const scaleConsideration = <
    Consideration extends {
      readonly curve: { readonly from: number; readonly to: number };
      readonly input: string;
    },
  >(
    consideration: Consideration,
  ): Consideration =>
    spatial.has(consideration.input)
      ? {
          ...consideration,
          curve: {
            ...consideration.curve,
            from: consideration.curve.from * tile,
            to: consideration.curve.to * tile,
          },
        }
      : consideration;
  const states = Object.fromEntries(
    Object.entries(plan.states).map(([key, node]) => {
      if (
        node.transitions.some(({ score }) => score) &&
        (key !== scorer?.engaged ||
          !node.transitions.every(
            ({ score }) =>
              !score || (valid(score.base) && (score.special === true || score.special === false)),
          ))
      ) {
        throw new Error(`Scored transitions require the scorer's engaged state in ${key}`);
      }
      if (
        node.attack &&
        (plan.attackCooldownSeconds === undefined ||
          !node.attack.id ||
          !["tell", "committed", "completed"].includes(node.attack.phase) ||
          (node.attack.continues && node.attack.phase !== "tell"))
      ) {
        throw new Error(`Invalid attack phase in ${key}`);
      }
      for (const transition of node.transitions) {
        const target = plan.states[transition.to]?.attack;
        const sameAttack = target !== undefined && target.id === node.attack?.id;
        if (
          node.attack?.phase === "committed" &&
          (!sameAttack || (target.phase === "tell" && !target.continues))
        ) {
          throw new Error(`Committed attack requires a completed boundary in ${key}`);
        }
        // No feints: a tell commits its own attack or cancels.
        if (
          node.attack?.phase === "tell" &&
          !node.attack.continues &&
          target &&
          (!sameAttack || target.phase === "completed" || target.continues)
        ) {
          throw new Error(`Tell must commit its attack or cancel in ${key}`);
        }
        if (
          node.attack?.continues &&
          (!sameAttack || (target.phase === "tell" && !target.continues))
        ) {
          throw new Error(`Continuing tell requires its committed attack or completion in ${key}`);
        }
        if (
          target?.continues &&
          (!sameAttack ||
            node.attack!.phase === "completed" ||
            (node.attack!.phase === "tell" && !node.attack!.continues))
        ) {
          throw new Error(`Continuing tell requires its committed attack in ${key}`);
        }
        if (
          target?.phase === "committed" &&
          (!node.attack || node.attack.id !== target.id || node.attack.phase === "completed")
        ) {
          throw new Error(`Committed attack requires a tell in ${key}`);
        }
      }
      const track = node.track ?? plan;
      if (!["x", "y"].includes(track.axis) || !Number.isFinite(track.distance)) {
        throw new Error(`Invalid behaviour track in ${key}`);
      }
      if (
        (node.animation !== null &&
          (typeof node.animation !== "string" || node.animation.length === 0)) ||
        (node.motion.kind !== "wait" &&
          node.motion.kind !== "fly" &&
          node.motion.kind !== "pursue" &&
          (!valid(node.motion.speed) ||
            ![-1, 1, "facing", "target"].includes(node.motion.direction))) ||
        (node.motion.kind === "move" && (node.motion.speed === 0 || track.distance === 0)) ||
        ((node.motion.kind === "move" || node.motion.kind === "hop") &&
          node.motion.distance !== undefined &&
          (!valid(node.motion.distance) || node.motion.distance === 0)) ||
        (node.motion.kind === "hop" &&
          (track.axis !== "x" ||
            !valid(node.motion.hopHeight) ||
            node.motion.hopHeight === 0 ||
            !valid(node.motion.hopSeconds) ||
            node.motion.hopSeconds === 0 ||
            (node.motion.speed > 0 && track.distance === 0)))
      ) {
        throw new Error(`Invalid behaviour motion or animation in ${key}`);
      }
      if (
        node.motion.kind === "pursue" &&
        (!plan.pursuit ||
          !["ground", "fly"].includes(node.motion.mode) ||
          !valid(node.motion.speed) ||
          node.motion.speed === 0)
      ) {
        throw new Error(`Invalid pursuit motion in ${key}`);
      }
      if (
        node.motion.kind === "pursue" &&
        node.motion.mode === "fly" &&
        node.motion.overhead &&
        (!Number.isFinite(node.motion.overhead.ahead) ||
          node.motion.overhead.ahead <= 0 ||
          !valid(node.motion.overhead.clearance))
      ) {
        throw new Error(`Invalid overhead pursuit in ${key}`);
      }
      if (
        node.motion.kind === "fly" &&
        (!valid(node.motion.speed) ||
          node.motion.speed === 0 ||
          (node.motion.to === "support"
            ? !plan.pursuit
            : typeof node.motion.to === "string"
              ? ![
                  node.motion.bounds.x,
                  node.motion.bounds.y,
                  node.motion.bounds.width,
                  node.motion.bounds.height,
                ].every(Number.isFinite) ||
                node.motion.bounds.width <= 0 ||
                node.motion.bounds.height <= 0
              : !Number.isFinite(node.motion.to.x) || !Number.isFinite(node.motion.to.y)))
      ) {
        throw new Error(`Invalid flight in ${key}`);
      }
      if (node.motion.kind === "fly" && node.motion.to === "support" && node.motion.selection) {
        const selection = node.motion.selection;
        if (
          selection.kind !== "varied" ||
          ![selection.distance, selection.minDistance, selection.clearance].every(
            (value) => Number.isFinite(value) && value > 0,
          ) ||
          selection.minDistance > selection.distance ||
          !Number.isSafeInteger(selection.maxAttempts) ||
          selection.maxAttempts <= 0
        ) {
          throw new Error(`Invalid supported flight selection in ${key}`);
        }
      }
      if (
        node.motion.kind === "pursue" &&
        node.motion.mode === "ground" &&
        node.motion.traversal &&
        (![
          node.motion.traversal.gravity,
          node.motion.traversal.jumpSpeed,
          node.motion.traversal.maxFallSpeed,
          node.motion.traversal.speed,
        ].every((value) => Number.isFinite(value) && value > 0) ||
          !Number.isFinite(node.motion.traversal.prepSeconds) ||
          node.motion.traversal.prepSeconds < 0 ||
          (node.motion.traversal.prepIntervalSeconds !== undefined &&
            !(
              node.motion.traversal.prepIntervalSeconds >= 0 &&
              Number.isFinite(node.motion.traversal.prepIntervalSeconds)
            )))
      ) {
        throw new Error(`Invalid ground traversal in ${key}`);
      }
      if (
        node.motion.kind === "fly" &&
        node.motion.to === "target-x" &&
        (!valid(node.motion.leadSeconds) ||
          !valid(node.motion.maxLead) ||
          (node.motion.ahead !== undefined && !valid(node.motion.ahead)))
      ) {
        throw new Error(`Invalid horizontal target lead in ${key}`);
      }
      const onEnter = node.onEnter?.map((action): BehaviourAction => {
        const finitePoint = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
        if (action.kind === "spawn") {
          if (
            !action.character ||
            !finitePoint(action.offset) ||
            !finitePoint(action.velocity) ||
            !valid(action.gravity) ||
            !valid(action.armSeconds) ||
            (action.armingAnimation !== undefined && action.armingAnimation.length === 0) ||
            !valid(action.lifeSeconds) ||
            action.lifeSeconds === 0 ||
            !Number.isSafeInteger(action.maxAlive) ||
            action.maxAlive < 1
          ) {
            throw new Error(`Invalid spawn action in ${key}`);
          }
          return {
            ...action,
            gravity: action.gravity * tile,
            offset: { x: action.offset.x * tile, y: action.offset.y * tile },
            velocity: { x: action.velocity.x * tile, y: action.velocity.y * tile },
          };
        }
        if (
          (action.visual &&
            (!action.visual.art ||
              !action.visual.animation ||
              !finitePoint(action.visual.offset))) ||
          !valid(action.range) ||
          !valid(action.height) ||
          !valid(action.seconds) ||
          !finitePoint(action.velocity)
        ) {
          throw new Error(`Invalid force action in ${key}`);
        }
        return {
          ...action,
          ...(action.visual && {
            visual: {
              ...action.visual,
              offset: { x: action.visual.offset.x * tile, y: action.visual.offset.y * tile },
            },
          }),
          height: action.height * tile,
          range: action.range * tile,
          velocity: { x: action.velocity.x * tile, y: action.velocity.y * tile },
        };
      });
      const transitions = node.transitions.map((transition) => {
        if (!plan.states[transition.to] || transition.when.length === 0) {
          throw new Error(`Invalid behaviour transition in ${key}`);
        }
        const resolve = (condition: BehaviourCondition): BehaviourCondition => {
          if (condition.kind === "not") {
            return { ...condition, condition: resolve(condition.condition) };
          }
          if (
            condition.kind === "attack-ready" ||
            condition.kind === "targeted-attack-allowed" ||
            condition.kind === "boundary" ||
            condition.kind === "visible" ||
            condition.kind === "line-of-sight" ||
            condition.kind === "alignment-blocked" ||
            condition.kind === "pursuit-ended" ||
            condition.kind === "target-above"
          ) {
            return condition;
          }
          if (condition.kind === "blocked" || condition.kind === "track-clear") {
            const motion = (condition.kind === "blocked" ? node : plan.states[condition.state])
              ?.motion.kind;
            if (motion !== "move" && motion !== "hop") {
              throw new Error(`Invalid track condition in ${key}`);
            }
            return condition;
          }
          if (condition.kind === "track-moves") {
            if (plan.states[condition.state]?.motion.kind !== "move") {
              throw new Error(`Invalid track move condition in ${key}`);
            }
            return condition;
          }
          if (condition.kind === "flight-approach-direction") {
            if (![-1, 1].includes(condition.direction)) {
              throw new Error(`Invalid flight approach direction in ${key}`);
            }
            return condition;
          }
          if (condition.kind === "track-room") {
            if (
              (node.motion.kind !== "move" && node.motion.kind !== "hop") ||
              !valid(condition.distance)
            ) {
              throw new Error(`Invalid track room in ${key}`);
            }
            return { ...condition, distance: condition.distance * tile };
          }
          if (condition.kind === "horizontal-gap" || condition.kind === "height-gap") {
            if (
              !["at-least", "below"].includes(condition.comparison) ||
              !valid(condition.distance)
            ) {
              const axis = condition.kind === "horizontal-gap" ? "horizontal" : "height";
              throw new Error(`Invalid ${axis} gap in ${key}`);
            }
            return { ...condition, distance: condition.distance * tile };
          }
          if (condition.kind === "arrived") {
            if (condition.target !== undefined && !["live", "intent"].includes(condition.target)) {
              throw new Error(`Invalid arrival target in ${key}`);
            }
            if (
              condition.target === "intent" &&
              (node.attack !== undefined ||
                node.motion.kind !== "pursue" ||
                node.motion.mode !== "fly" ||
                node.motion.overhead === undefined ||
                key !== scorer?.engaged)
            ) {
              throw new Error(`Intent arrival requires scored overhead pursuit in ${key}`);
            }
          }
          const amount =
            condition.kind === "elapsed"
              ? condition.seconds
              : condition.kind === "nearby"
                ? condition.range
                : condition.tolerance;
          if (!valid(amount)) {
            throw new Error(`Invalid behaviour condition in ${key}`);
          }
          return condition.kind === "nearby"
            ? { ...condition, range: condition.range * tile }
            : condition.kind !== "elapsed"
              ? { ...condition, tolerance: condition.tolerance * tile }
              : condition;
        };
        return {
          ...transition,
          ...(transition.score && {
            score: {
              ...transition.score,
              considerations: transition.score.considerations.map(scaleConsideration),
            },
          }),
          when: transition.when.map(resolve),
        };
      });
      return [
        key,
        {
          ...node,
          ...(onEnter && { onEnter }),
          ...(node.track && { track: { ...node.track, distance: node.track.distance * tile } }),
          motion:
            node.motion.kind === "wait"
              ? node.motion
              : {
                  ...node.motion,
                  speed: node.motion.speed * tile,
                  ...(node.motion.kind === "pursue" &&
                    node.motion.mode === "ground" &&
                    node.motion.traversal && {
                      traversal: {
                        gravity: node.motion.traversal.gravity * tile,
                        jumpSpeed: node.motion.traversal.jumpSpeed * tile,
                        maxFallSpeed: node.motion.traversal.maxFallSpeed * tile,
                        prepSeconds: node.motion.traversal.prepSeconds,
                        ...(node.motion.traversal.prepIntervalSeconds !== undefined && {
                          prepIntervalSeconds: node.motion.traversal.prepIntervalSeconds,
                        }),
                        speed: node.motion.traversal.speed * tile,
                      },
                    }),
                  ...(node.motion.kind === "pursue" &&
                    node.motion.mode === "fly" &&
                    node.motion.overhead && {
                      overhead: {
                        ahead: node.motion.overhead.ahead * tile,
                        clearance: node.motion.overhead.clearance * tile,
                      },
                    }),
                  ...(node.motion.kind === "fly"
                    ? node.motion.to === "support"
                      ? node.motion.selection
                        ? {
                            selection: {
                              ...node.motion.selection,
                              clearance: node.motion.selection.clearance * tile,
                              distance: node.motion.selection.distance * tile,
                              ...(node.motion.selection.home !== undefined && {
                                home: node.motion.selection.home * tile,
                              }),
                              minDistance: node.motion.selection.minDistance * tile,
                            },
                          }
                        : {}
                      : typeof node.motion.to === "string"
                        ? {
                            ...(node.motion.to === "target-x" && {
                              ...(node.motion.ahead !== undefined && {
                                ahead: node.motion.ahead * tile,
                              }),
                              maxLead: node.motion.maxLead * tile,
                            }),
                            bounds: {
                              height: node.motion.bounds.height * tile,
                              width: node.motion.bounds.width * tile,
                              x: node.motion.bounds.x * tile,
                              y: node.motion.bounds.y * tile,
                            },
                          }
                        : { to: { x: node.motion.to.x * tile, y: node.motion.to.y * tile } }
                    : {}),
                  ...(node.motion.kind === "hop"
                    ? { hopHeight: node.motion.hopHeight * tile }
                    : {}),
                  ...((node.motion.kind === "move" || node.motion.kind === "hop") &&
                  node.motion.distance !== undefined
                    ? { distance: node.motion.distance * tile }
                    : {}),
                },
          transitions,
        },
      ];
    }),
  );
  return {
    ...plan,
    ...(scorer && {
      scorer: {
        ...scorer,
        moves: scorer.moves.map((entry) => ({
          ...entry,
          considerations: entry.considerations.map(scaleConsideration),
          move:
            entry.move.kind === "chase"
              ? entry.move
              : entry.move.kind === "cut-off"
                ? { ...entry.move, maxLead: entry.move.maxLead * tile }
                : { ...entry.move, distance: entry.move.distance * tile },
        })),
      },
    }),
    ...(watchdog && {
      idleWatchdog: {
        ...watchdog,
        distance: watchdog.distance * tile,
        minMovement: watchdog.minMovement * tile,
      },
    }),
    ...(plan.pursuit && {
      pursuit: {
        ...plan.pursuit,
        distance: plan.pursuit.distance * tile,
        ...(plan.pursuit.escapeDistance !== undefined && {
          escapeDistance: plan.pursuit.escapeDistance * tile,
        }),
        ...(plan.pursuit.screen && {
          screen: {
            margin: plan.pursuit.screen.margin * tile,
            width: plan.pursuit.screen.width * tile,
          },
        }),
        ...(plan.pursuit.pace && {
          pace: {
            ...plan.pursuit.pace,
            distance: plan.pursuit.pace.distance * tile,
            speed: plan.pursuit.pace.speed * tile,
          },
        }),
      },
    }),
    ...(wander && {
      wander: {
        ...wander,
        range: wander.range * tile,
        ...(wander.walk && {
          walk: {
            distance: {
              max: wander.walk.distance.max * tile,
              min: wander.walk.distance.min * tile,
            },
            speed: wander.walk.speed * tile,
          },
        }),
      },
    }),
    distance: plan.distance * tile,
    states,
  };
}
