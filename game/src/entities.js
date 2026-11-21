// entities.js — the living garden: the courier, the wardens and the rules that
// decide when the courier is seen, heard, caught or home free. Pure logic with
// no canvas calls, so a headless test can play a whole night through it.

import { GUARD_PATROLS, TILE, TUNING } from './config.js';
import {
  parseLevel,
  tileAt,
  moveWithCollision,
  hasLineOfSight,
  isInBush,
} from './level.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_RETURN = 'return';

let nextPebbleId = 1;

/** A fresh night: courier at the west gate, wardens on their rounds, keys waiting. */
export function createWorld(seed = 1) {
  const level = parseLevel();
  const guards = GUARD_PATROLS.map((patrol, index) => {
    const [col, row] = patrol.waypoints[0];
    return {
      id: index,
      name: patrol.name,
      x: col * TILE + TILE / 2,
      y: row * TILE + TILE / 2,
      angle: 0,
      waypointIndex: 1,
      pauseLeft: 0,
      state: GUARD_PATROL,
      suspicion: 0,
      alertLeft: 0,
      investigateX: 0,
      investigateY: 0,
      patrol,
      speed: TUNING.guardWalkSpeed,
      stepPhase: seed * 0.7 + index * 1.3,
    };
  });
  return {
    level,
    time: 0,
    player: {
      x: level.playerStart.x,
      y: level.playerStart.y,
      angle: 0,
      moving: false,
      running: false,
      sneaking: false,
      hidden: false,
      moveTarget: null,
      stepPhase: 0,
      lastStepAt: 0,
    },
    guards,
    pebbles: [],
    pebblesLeft: TUNING.pebbles,
    keysCollected: 0,
    nerves: TUNING.nerves,
    timesCaught: 0,
    timesAlerted: 0,
    alarm: 0, // 0..1, the garden-wide alarm the HUD shows
    caught: false,
    won: false,
    lost: false,
    message: '',
    messageAt: 0,
    events: [], // one-frame notices for the sound engine: { type, x, y }
  };
}

function pushEvent(world, type, x, y) {
  world.events.push({ type, x, y });
}

/** Can this warden see the courier right now? Cone, range, hedge and bush rules. */
export function guardSeesPlayer(world, guard) {
  const { player, level } = world;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > TUNING.visionRange) return false;
  const hiddenInBush = player.hidden && dist > TUNING.bushHideRange;
  if (hiddenInBush) return false;
  let angleTo = Math.atan2(dy, dx);
  let diff = angleTo - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > TUNING.visionHalfAngle) return false;
  return hasLineOfSight(level, guard.x, guard.y, player.x, player.y);
}

/** Is this tile inside any warden's cone and line of sight right now? */
export function tileIsWatched(world, col, row) {
  const x = col * TILE + TILE / 2;
  const y = row * TILE + TILE / 2;
  for (const guard of world.guards) {
    const dx = x - guard.x;
    const dy = y - guard.y;
    if (Math.hypot(dx, dy) > TUNING.visionRange) continue;
    let diff = Math.atan2(dy, dx) - guard.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > TUNING.visionHalfAngle) continue;
    if (hasLineOfSight(world.level, guard.x, guard.y, x, y)) return true;
  }
  return false;
}

function guardTargetPoint(guard) {
  const wp = guard.patrol.waypoints[guard.waypointIndex];
  return { x: wp[0] * TILE + TILE / 2, y: wp[1] * TILE + TILE / 2 };
}

function moveToward(world, guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  const moved = moveWithCollision(world.level, guard.x, guard.y, nx - guard.x, ny - guard.y, TUNING.guardRadius);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.angle = Math.atan2(dy, dx);
  guard.stepPhase += dt * 6;
  return dist <= speed * dt + 2;
}

function updateGuard(world, guard, dt) {
  const sees = guardSeesPlayer(world, guard);
  if (sees) {
    const dist = Math.hypot(world.player.x - guard.x, world.player.y - guard.y);
    const closeness = 1.6 - Math.min(1, dist / TUNING.visionRange);
    guard.suspicion = Math.min(1, guard.suspicion + TUNING.suspicionPerSecond * closeness * dt);
    guard.investigateX = world.player.x;
    guard.investigateY = world.player.y;
    if (guard.suspicion >= 1 && guard.state !== GUARD_ALERT) {
      guard.state = GUARD_ALERT;
      guard.alertLeft = TUNING.alertHoldSeconds;
      world.timesAlerted += 1;
      pushEvent(world, 'spotted', guard.x, guard.y);
    } else if (guard.suspicion > 0.35 && guard.state === GUARD_PATROL) {
      guard.state = GUARD_SUSPICIOUS;
      pushEvent(world, 'suspicious', guard.x, guard.y);
    }
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - TUNING.suspicionDecayPerSecond * dt);
    if (guard.state === GUARD_SUSPICIOUS && guard.suspicion <= 0.05) guard.state = GUARD_PATROL;
  }

  if (guard.state === GUARD_ALERT) {
    if (sees) guard.alertLeft = TUNING.alertHoldSeconds;
    else guard.alertLeft -= dt;
    if (guard.alertLeft <= 0) {
      guard.state = GUARD_RETURN;
      guard.suspicion = 0.4;
    } else {
      moveToward(world, guard, world.player.x, world.player.y, TUNING.guardChaseSpeed, dt);
    }
  } else if (guard.state === GUARD_SUSPICIOUS) {
    const arrived = moveToward(world, guard, guard.investigateX, guard.investigateY, TUNING.guardWalkSpeed * 1.25, dt);
    if (arrived) {
      guard.pauseLeft = 1.6;
      guard.state = GUARD_RETURN;
    }
  } else if (guard.state === GUARD_RETURN) {
    if (guard.pauseLeft > 0) {
      guard.pauseLeft -= dt;
      guard.angle += dt * 1.5; // look around while wondering
    } else {
      // Walk back to the nearest patrol waypoint, then resume the round.
      let best = 0;
      let bestDist = Infinity;
      guard.patrol.waypoints.forEach((wp, i) => {
        const d = Math.hypot(wp[0] * TILE + TILE / 2 - guard.x, wp[1] * TILE + TILE / 2 - guard.y);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      guard.waypointIndex = best;
      guard.state = GUARD_PATROL;
    }
  } else {
    // Patrol: walk to the next waypoint, pause, turn to the next leg.
    if (guard.pauseLeft > 0) {
      guard.pauseLeft -= dt;
      return;
    }
    const target = guardTargetPoint(guard);
    const arrived = moveToward(world, guard, target.x, target.y, TUNING.guardWalkSpeed, dt);
    if (arrived) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.patrol.waypoints.length;
      guard.pauseLeft = guard.patrol.pause;
    }
  }
}

/** A footstep's noise reaches every warden inside its ring; they come and look. */
function emitNoise(world, x, y, radius) {
  for (const guard of world.guards) {
    if (guard.state === GUARD_ALERT) continue;
    const dist = Math.hypot(guard.x - x, guard.y - y);
    if (dist > radius) continue;
    if (guard.state !== GUARD_SUSPICIOUS || Math.hypot(guard.investigateX - x, guard.investigateY - y) > 30) {
      guard.investigateX = x;
      guard.investigateY = y;
      guard.state = GUARD_SUSPICIOUS;
      guard.suspicion = Math.max(guard.suspicion, 0.45);
    }
  }
}

/** Toss a pebble toward a point: it clatters, and nearby wardens investigate. */
export function throwPebble(world, tx, ty) {
  if (world.pebblesLeft <= 0 || world.won || world.lost) return false;
  const dx = tx - world.player.x;
  const dy = ty - world.player.y;
  const dist = Math.min(Math.hypot(dx, dy), 260);
  const angle = Math.atan2(dy, dx);
  const lx = world.player.x + Math.cos(angle) * dist;
  const ly = world.player.y + Math.sin(angle) * dist;
  world.pebbles.push({ id: nextPebbleId, x: lx, y: ly, age: 0 });
  nextPebbleId += 1;
  world.pebblesLeft -= 1;
  pushEvent(world, 'pebble', lx, ly);
  emitNoise(world, lx, ly, TUNING.noisePebbleRadius);
  return true;
}

function updatePlayer(world, input, dt) {
  const p = world.player;
  let mx = 0;
  let my = 0;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.moveTarget && (mx !== 0 || my !== 0)) input.moveTarget = null;
  if (mx === 0 && my === 0 && input.moveTarget) {
    const dx = input.moveTarget.x - p.x;
    const dy = input.moveTarget.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      input.moveTarget = null;
    } else {
      mx = dx / dist;
      my = dy / dist;
    }
  }
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (!p.moving) return;
  mx /= len;
  my /= len;
  p.running = !!input.run && !input.sneak;
  p.sneaking = !!input.sneak;
  const speed = p.running ? TUNING.playerRunSpeed : p.sneaking ? TUNING.playerSneakSpeed : TUNING.playerWalkSpeed;
  const moved = moveWithCollision(world.level, p.x, p.y, mx * speed * dt, my * speed * dt, TUNING.playerRadius);
  p.x = moved.x;
  p.y = moved.y;
  p.angle = Math.atan2(my, mx);
  p.stepPhase += dt * (p.running ? 11 : p.sneaking ? 5 : 8);
  // Footsteps: a soft tick walking, a louder one running, none while sneaking.
  const stepInterval = p.running ? 0.30 : 0.42;
  if (world.time - p.lastStepAt > stepInterval) {
    p.lastStepAt = world.time;
    pushEvent(world, p.running ? 'step-loud' : 'step', p.x, p.y);
    if (p.running) emitNoise(world, p.x, p.y, TUNING.noiseRunRadius);
  }
}

/** One fixed step of the night: player, wardens, keys, gate, alarm. */
export function stepWorld(world, input, dt) {
  if (world.won || world.lost) return;
  world.time += dt;
  world.events.length = 0;
  updatePlayer(world, input, dt);
  const p = world.player;
  p.hidden = isInBush(world.level, p.x, p.y);

  for (const guard of world.guards) updateGuard(world, guard, dt);

  // The alarm is the loudest warden's suspicion; it drains when nobody is seen.
  let loudest = 0;
  for (const guard of world.guards) {
    if (guard.state === GUARD_ALERT) loudest = Math.max(loudest, 1);
    else loudest = Math.max(loudest, guard.suspicion);
  }
  world.alarm = Math.max(loudest, world.alarm - dt * 0.25);

  // Pebbles fade after a few seconds.
  for (const pebble of world.pebbles) pebble.age += dt;
  world.pebbles = world.pebbles.filter((pebble) => pebble.age < 6);

  // Keys: walk over a silver lantern key to pocket it.
  for (const key of world.level.keys) {
    if (key.taken) continue;
    if (Math.hypot(key.x - p.x, key.y - p.y) < 26) {
      key.taken = true;
      world.keysCollected += 1;
      pushEvent(world, 'key', key.x, key.y);
      world.message = world.keysCollected >= TUNING.keysNeeded
        ? 'All three keys! The garden gate stands open — go, unseen.'
        : `Lantern key ${world.keysCollected} of ${TUNING.keysNeeded} pocketed.`;
      world.messageAt = world.time;
    }
  }

  // The gate opens once every key is pocketed; reaching it ends the night.
  const gateOpen = world.keysCollected >= TUNING.keysNeeded;
  if (gateOpen && Math.hypot(world.level.gate.x - p.x, world.level.gate.y - p.y) < 30) {
    world.won = true;
    // The night is over: the garden calms, so the win screen shows quiet grounds.
    world.alarm = 0;
    for (const guard of world.guards) {
      guard.state = GUARD_PATROL;
      guard.suspicion = 0;
      guard.alertLeft = 0;
    }
    pushEvent(world, 'win', p.x, p.y);
    return;
  }

  // Caught: a warden close enough while the alarm is up.
  for (const guard of world.guards) {
    if (guard.state !== GUARD_ALERT) continue;
    if (Math.hypot(guard.x - p.x, guard.y - p.y) < TUNING.catchDistance) {
      world.timesCaught += 1;
      world.nerves -= 1;
      pushEvent(world, 'caught', p.x, p.y);
      if (world.nerves <= 0) {
        world.lost = true;
      } else {
        // Slip away in the dark: back to the west gate, wardens lose the trail.
        p.x = world.level.playerStart.x;
        p.y = world.level.playerStart.y;
        input.moveTarget = null;
        for (const g of world.guards) {
          g.state = GUARD_PATROL;
          g.suspicion = 0;
          g.alertLeft = 0;
        }
        world.alarm = 0;
        world.message = `Caught! A warden found you — ${world.nerves} ${world.nerves === 1 ? 'nerve' : 'nerves'} left.`;
        world.messageAt = world.time;
      }
      return;
    }
  }
}

/** The courier's grade for the night, read out on the win screen. */
export function gradeNight(world) {
  if (world.timesCaught === 0 && world.timesAlerted === 0) return { title: 'GHOST', line: 'Not a single warden knew you were there.' };
  if (world.timesCaught === 0) return { title: 'SHADOW', line: 'Spotted once or twice, but never caught.' };
  return { title: 'LOUD', line: 'You were caught, but you still slipped away with the keys.' };
}
