// shots.js — the scenes behind ?shot=start|play|alert|win, and the autopilot
// that plays them. Every scene is the real game stepped forward from a fresh
// world with a fixed seed, so the same seed always gives the same frame —
// and so a headless test can play a whole night through the same pilot.

import { TILE } from './config.js';
import { createWorld, stepWorld, tileIsWatched, GUARD_ALERT, GUARD_PATROL } from './entities.js';
import { findPath, findSafePath, tileAt, isInBush } from './level.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const STEP = 1 / 60;
const IDLE_INPUT = { up: false, down: false, left: false, right: false, run: false, sneak: false, moveTarget: null };

function nearestBushTile(world) {
  const p = world.player;
  let best = null;
  let bestDist = Infinity;
  for (const bush of world.level.bushes) {
    const d = Math.hypot(bush.x - p.x, bush.y - p.y);
    if (d < bestDist) { bestDist = d; best = bush; }
  }
  return best;
}

/**
 * The autopilot: a patient courier. It picks one key and sticks with it until
 * the key is pocketed (two keys can be almost exactly as far away, and a pilot
 * that changes its mind every step walks in circles), routes to it along the
 * cheapest path, paying dearly for tiles a warden can see, and when a warden
 * gives chase it dives for the nearest bush and waits the alarm out.
 */
export function makeAutopilot(world) {
  let path = null;
  let target = null;
  let waitUntil = 0;
  let waitSince = 0;
  let replanAt = 0;

  function pickTarget() {
    const keys = world.level.keys.filter((k) => !k.taken);
    if (keys.length > 0) {
      let best = keys[0];
      let bestDist = Infinity;
      for (const key of keys) {
        const d = Math.hypot(key.x - world.player.x, key.y - world.player.y);
        if (d < bestDist) { bestDist = d; best = key; }
      }
      return best;
    }
    return world.level.gate;
  }

  function replan() {
    const from = tileAt(world.level, world.player.x, world.player.y);
    const dangerAt = (col, row) => tileIsWatched(world, col, row);
    path = findSafePath(world.level, from.col, from.row, target.col, target.row, dangerAt)
      || findPath(world.level, from.col, from.row, target.col, target.row);
    replanAt = world.time + 1.5;
  }

  return function autopilotInput() {
    const input = { ...IDLE_INPUT };
    const p = world.player;
    const anyAlert = world.guards.some((g) => g.state === GUARD_ALERT);

    if (anyAlert) {
      const bush = nearestBushTile(world);
      if (bush && !isInBush(world.level, p.x, p.y)) {
        input.moveTarget = { x: bush.x, y: bush.y };
        input.run = true; // already spotted: noise no longer matters, speed does
        return input;
      }
      if (isInBush(world.level, p.x, p.y)) return input; // stay hidden
    }
    if (world.time < waitUntil) return input;

    // One target at a time, kept until it is pocketed; the route to it is
    // refreshed every 1.5 seconds so moving cones are taken into account.
    if (!target || target.taken) target = pickTarget();
    if (!path || path.length === 0 || world.time >= replanAt) replan();
    if (!path || path.length === 0) return input;
    // Drop waypoints already reached; head for the next one.
    while (path.length > 1) {
      const [col, row] = path[0];
      if (Math.hypot(col * TILE + TILE / 2 - p.x, row * TILE + TILE / 2 - p.y) < 14) path.shift();
      else break;
    }
    const [col, row] = path[0];
    const wx = col * TILE + TILE / 2;
    const wy = row * TILE + TILE / 2;
    if (Math.hypot(wx - p.x, wy - p.y) < 10 && path.length > 1) {
      path.shift();
    }
    const [ncol, nrow] = path[0];
    input.moveTarget = { x: ncol * TILE + TILE / 2, y: nrow * TILE + TILE / 2 };
    // If the next tile is watched right now, wait a moment for the cone to pass.
    // If it stays watched, the route itself is the problem: replan around it.
    if (tileIsWatched(world, ncol, nrow) && !anyAlert) {
      const guardNear = world.guards.some((g) => Math.hypot(g.x - p.x, g.y - p.y) < 120);
      if (!guardNear) {
        if (waitSince === 0) waitSince = world.time;
        if (world.time - waitSince > 2.5) {
          replanAt = 0;
          waitSince = 0;
        } else {
          input.moveTarget = null;
          waitUntil = world.time + 0.4;
        }
        return input;
      }
      waitSince = 0;
      input.sneak = true;
    } else {
      waitSince = 0;
    }
    return input;
  };
}

/**
 * Play the real rules forward from a fresh world until the named scene, and
 * return the screen to draw over it. Deterministic: same seed, same frame.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    const pilot = makeAutopilot(world);
    for (let i = 0; i < 60 * 24; i += 1) {
      stepWorld(world, pilot(), STEP);
      if (world.won || world.lost) break;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'alert') {
    // Slip the courier through the garden until a warden spots him, then let
    // the chase run a moment longer so the frame shows red cones and a hunt.
    const pilot = makeAutopilot(world);
    for (let i = 0; i < 60 * 40; i += 1) {
      stepWorld(world, pilot(), STEP);
      if (world.guards.some((g) => g.state === GUARD_ALERT)) break;
      if (world.won || world.lost) break;
    }
    if (!world.guards.some((g) => g.state === GUARD_ALERT)) {
      // The patient pilot never got seen: stage the alarm by hand instead.
      // Put a warden in the open south lawn, facing the courier 90 px away,
      // and hold him there until his suspicion fills — then freeze the frame
      // at the very moment the alarm trips.
      const guard = world.guards[2];
      guard.x = 500;
      guard.y = 300;
      guard.angle = 0;
      guard.state = GUARD_PATROL;
      guard.suspicion = 0;
      guard.pauseLeft = 999;
      world.player.x = 590;
      world.player.y = 300;
      for (let i = 0; i < 60 * 3; i += 1) {
        stepWorld(world, { ...IDLE_INPUT }, STEP);
        if (world.guards.some((g) => g.state === GUARD_ALERT)) break;
      }
    } else {
      // One more breath of the chase: the courier flees for the nearest bush.
      for (let i = 0; i < 60 * 0.8; i += 1) {
        stepWorld(world, pilot(), STEP);
        if (world.lost || world.won) break;
      }
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    const pilot = makeAutopilot(world);
    for (let i = 0; i < 60 * 300; i += 1) {
      stepWorld(world, pilot(), STEP);
      if (world.won || world.lost) break;
    }
    return { screen: world.won ? SCREEN_WIN : SCREEN_PLAY };
  }
  if (name === 'over') {
    const guard = world.guards[0];
    world.player.x = guard.x + 30;
    world.player.y = guard.y;
    guard.state = GUARD_ALERT;
    guard.suspicion = 1;
    for (let i = 0; i < 60 * 8; i += 1) {
      stepWorld(world, { ...IDLE_INPUT }, STEP);
      if (world.lost) break;
    }
    return { screen: world.lost ? SCREEN_OVER : SCREEN_PLAY };
  }
  // start: the title screen over a garden already on patrol, the courier
  // crouched in a far bush so no warden spots her before the night begins.
  world.player.x = 16 * TILE + TILE / 2;
  world.player.y = 3 * TILE + TILE / 2;
  for (let i = 0; i < 60 * 6; i += 1) stepWorld(world, { ...IDLE_INPUT }, STEP);
  return { screen: SCREEN_TITLE };
}

/** A world staged for a screenshot: fresh, seeded, played to the named scene. */
export function worldForShot(name, seed = 1) {
  const world = createWorld(seed);
  const staged = stageShot(name, world);
  return { world, screen: staged.screen };
}
