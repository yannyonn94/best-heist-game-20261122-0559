// player.js is Marlowe, the thief. WASD or arrows walk; a mouse click sets a walk target;
// Space or E grabs loot. Three tools hang on the belt, each with a price: the EMP (key 1)
// kills every camera for 10 seconds and costs $400 of the take, the smoke bomb (key 2) drops
// a cloud that hides the thief for 6 seconds, and the disguise (key 3) passes the thief off
// as casino staff for 8 seconds — slower, and worth $300 — while the cameras still watch.

import { DISGUISE_SPEED, PLAYER, SMOKE_RADIUS, TOOLS } from './config.js';
import { carrySpeedMultiplier } from './loot.js';
import { moveCircle } from './level.js';

/** Fresh thief at the service door, pockets empty, belt full. */
export function createPlayer(x, y) {
  return {
    x, y, radius: PLAYER.radius,
    /** Where a mouse click told the thief to walk; null when the keys drive. */
    target: null,
    /** Active tool timers, seconds left. */
    empTime: 0,
    disguiseTime: 0,
    smokeLeft: TOOLS.smoke.startCount,
    disguiseLeft: TOOLS.disguise.startCount,
    /** Dollars spent on tools this heist (EMP $400, disguise $300 a use). */
    toolSpend: 0,
    /** Smoke clouds on the floor: { x, y, radius, timeLeft }. */
    smokeClouds: [],
    /** Which way the thief faces, for the little hat and the walk bob. */
    facing: -Math.PI / 2,
    /** Walk-cycle phase, for the leg bob. */
    walkPhase: 0,
    moving: false,
  };
}

/**
 * Move the thief by one step. `keys` is { up, down, left, right } from the keyboard;
 * when no key is held and a click target is set, the thief walks toward the target.
 * Returns nothing; the player object is updated in place.
 */
export function stepPlayer(player, dt, keys, loot, obstacles) {
  let dx = 0;
  let dy = 0;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (dx === 0 && dy === 0 && player.target) {
    const tx = player.target.x - player.x;
    const ty = player.target.y - player.y;
    const distance = Math.hypot(tx, ty);
    if (distance < 6) {
      player.target = null;
    } else {
      dx = tx / distance;
      dy = ty / distance;
    }
  }
  const length = Math.hypot(dx, dy);
  player.moving = length > 0;
  if (player.moving) {
    let speed = PLAYER.speed * carrySpeedMultiplier(loot);
    if (player.disguiseTime > 0) speed *= DISGUISE_SPEED;
    const step = (speed * dt) / length;
    const moved = moveCircle(player.x, player.y, player.radius, dx * step, dy * step, obstacles);
    player.x = moved.x;
    player.y = moved.y;
    player.facing = Math.atan2(dy, dx);
    player.walkPhase += dt * 11;
  }
  // Tool timers tick down.
  if (player.empTime > 0) player.empTime = Math.max(0, player.empTime - dt);
  if (player.disguiseTime > 0) player.disguiseTime = Math.max(0, player.disguiseTime - dt);
  for (let i = player.smokeClouds.length - 1; i >= 0; i -= 1) {
    player.smokeClouds[i].timeLeft -= dt;
    if (player.smokeClouds[i].timeLeft <= 0) player.smokeClouds.splice(i, 1);
  }
}

/**
 * Use a tool. Returns a short event name ('emp' | 'smoke' | 'disguise' | 'none' | 'empty')
 * so the game can play the right sound and flash the right message.
 */
export function useTool(player, name, cameras, disableAllCameras) {
  if (name === 'emp') {
    if (player.empTime > 0) return 'none';
    player.empTime = TOOLS.emp.duration;
    player.toolSpend += TOOLS.emp.cost;
    disableAllCameras(cameras, TOOLS.emp.duration);
    return 'emp';
  }
  if (name === 'smoke') {
    if (player.smokeLeft <= 0) return 'empty';
    player.smokeLeft -= 1;
    player.smokeClouds.push({ x: player.x, y: player.y, radius: SMOKE_RADIUS, timeLeft: TOOLS.smoke.duration });
    return 'smoke';
  }
  if (name === 'disguise') {
    if (player.disguiseLeft <= 0) return 'empty';
    if (player.disguiseTime > 0) return 'none';
    player.disguiseLeft -= 1;
    player.disguiseTime = TOOLS.disguise.duration;
    player.toolSpend += TOOLS.disguise.cost;
    return 'disguise';
  }
  return 'none';
}

/** True when the thief is disguised right now (guards will not suspect). */
export function isDisguised(player) {
  return player.disguiseTime > 0;
}

/** The thief's current speed in pixels per second, for the HUD's weight readout. */
export function currentSpeed(player, loot) {
  let speed = PLAYER.speed * carrySpeedMultiplier(loot);
  if (player.disguiseTime > 0) speed *= DISGUISE_SPEED;
  return Math.round(speed);
}
