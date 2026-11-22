// guards.js moves the 5 guards and decides what they see. A guard walks its waypoint loop,
// pauses at each stop, and watches a cone in front of it. When the thief stands inside the
// cone with a clear line of sight, suspicion climbs; when it fills, the guard gives chase.
// Suspicion drains when the thief is hidden, so a careful thief is never caught instantly —
// the caught moment is always fair, always telegraphed.

import { GUARD } from './config.js';
import { lineBlocked, moveCircle } from './level.js';

/** Normalise an angle to (-PI, PI]. */
export function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff <= -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * True when `viewer` (at x, y, facing `angle`) can see `target`: inside the cone's range
 * and half-angle, with no wall or table between them.
 */
export function canSee(viewer, target, range, halfAngle, obstacles) {
  const dx = target.x - viewer.x;
  const dy = target.y - viewer.y;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  if (distance > 1 && Math.abs(angleDifference(Math.atan2(dy, dx), viewer.angle)) > halfAngle) return false;
  return !lineBlocked(viewer.x, viewer.y, target.x, target.y, obstacles);
}

/** True when the guard can see the thief right now (disguise fools guards, smoke hides). */
export function guardSeesThief(guard, player, obstacles, disguised, smokeClouds) {
  if (disguised) return false;
  for (let i = 0; i < smokeClouds.length; i += 1) {
    const cloud = smokeClouds[i];
    if (Math.hypot(player.x - cloud.x, player.y - cloud.y) < cloud.radius) return false;
  }
  return canSee(guard, player, GUARD.coneRange, GUARD.coneHalfAngle, obstacles);
}

/**
 * Advance one guard by `dt` seconds. Returns 'caught' when the guard touches the thief.
 * `player` is { x, y }; `events` collects the guard's name when it starts a chase.
 */
export function stepGuard(guard, dt, player, obstacles, disguised, smokeClouds, events) {
  const sees = guardSeesThief(guard, player, obstacles, disguised, smokeClouds);

  if (sees) {
    guard.suspicion += dt / GUARD.suspicionTime;
    guard.loseSight = 0;
    if (guard.suspicion >= 1 && !guard.chasing) {
      guard.chasing = true;
      events.push(guard.name);
    }
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - dt * 0.8);
    if (guard.chasing) {
      const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
      // A chasing guard that cannot see the thief at all gives up after 2.5 s, instead of
      // camping a wall forever while the thief waits on the other side of it.
      guard.loseSight += dt;
      if (distance > GUARD.giveUpRange || guard.loseSight > 2.5) {
        guard.chasing = false;
        guard.loseSight = 0;
      }
    }
  }
  guard.suspicion = Math.min(1, guard.suspicion);

  if (guard.chasing) {
    // Chase: run straight at the thief, sliding along walls.
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const distance = Math.hypot(dx, dy) || 1;
    const step = (GUARD.chaseSpeed * dt) / distance;
    const moved = moveCircle(guard.x, guard.y, GUARD.radius, dx * step, dy * step, obstacles);
    guard.x = moved.x;
    guard.y = moved.y;
    guard.angle = Math.atan2(dy, dx);
    guard.speed = GUARD.chaseSpeed;
    if (distance < GUARD.radius + 13) return 'caught';
    return null;
  }

  // Patrol: walk to the next waypoint, pause a beat, then carry on.
  if (guard.wait > 0) {
    guard.wait -= dt;
    guard.speed = 0;
    return null;
  }
  const target = guard.waypoints[guard.waypointIndex];
  const dx = target[0] - guard.x;
  const dy = target[1] - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 6) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.wait = 0.7;
    guard.speed = 0;
    return null;
  }
  const step = (GUARD.patrolSpeed * dt) / distance;
  const moved = moveCircle(guard.x, guard.y, GUARD.radius, dx * step, dy * step, obstacles);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.angle = Math.atan2(dy, dx);
  guard.speed = GUARD.patrolSpeed;
  return null;
}

/** The most suspicious guard right now, for the HUD's "WATCH OUT" callout. */
export function mostSuspiciousGuard(guards) {
  let best = null;
  for (let i = 0; i < guards.length; i += 1) {
    if (best === null || guards[i].suspicion > best.suspicion) best = guards[i];
  }
  return best;
}

/** Reset every guard to its first waypoint, suspicion clear — used after a catch. */
export function resetGuards(guards) {
  for (let i = 0; i < guards.length; i += 1) {
    const guard = guards[i];
    guard.x = guard.waypoints[0][0];
    guard.y = guard.waypoints[0][1];
    guard.waypointIndex = 1;
    guard.suspicion = 0;
    guard.chasing = false;
    guard.wait = 0;
    guard.speed = 0;
    guard.loseSight = 0;
    guard.angle = guard.waypoints.length > 1
      ? Math.atan2(guard.waypoints[1][1] - guard.y, guard.waypoints[1][0] - guard.x)
      : 0;
  }
}

/** How many guards are chasing right now (0 to 5). */
export function chasingCount(guards) {
  let count = 0;
  for (let i = 0; i < guards.length; i += 1) if (guards[i].chasing) count += 1;
  return count;
}
