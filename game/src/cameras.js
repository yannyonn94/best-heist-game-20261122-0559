// cameras.js sweeps the 8 security cameras and decides when one has the thief. A camera
// swings its lens back and forth across its arc; when the thief crosses its cone with a clear
// line of sight, the camera locks on over a short delay, then feeds the alarm. An EMP burst
// kills every camera for 10 seconds — the lens goes dark and the cone disappears — at a price
// paid from the take.

import { CAMERA } from './config.js';
import { canSee } from './guards.js';

/** Advance one camera's sweep by `dt` seconds and return whether it sees the thief. */
export function stepCamera(camera, dt, time, player, obstacles, smokeClouds) {
  if (camera.disabled > 0) {
    camera.disabled = Math.max(0, camera.disabled - dt);
    camera.lockOn = 0;
    return false;
  }
  camera.angle = camera.baseAngle + Math.sin(time * CAMERA.sweepSpeed + camera.phase) * camera.sweep;
  let hidden = false;
  for (let i = 0; i < smokeClouds.length; i += 1) {
    const cloud = smokeClouds[i];
    if (Math.hypot(player.x - cloud.x, player.y - cloud.y) < cloud.radius) hidden = true;
  }
  if (hidden) {
    camera.lockOn = 0;
    return false;
  }
  const seen = canSee(camera, player, CAMERA.coneRange, CAMERA.coneHalfAngle, obstacles);
  if (seen) camera.lockOn = Math.min(1, camera.lockOn + dt / CAMERA.lockOnTime);
  else camera.lockOn = Math.max(0, camera.lockOn - dt * 2);
  return camera.lockOn >= 1;
}

/** Kill every camera for `seconds` (the EMP burst). */
export function disableAllCameras(cameras, seconds) {
  for (let i = 0; i < cameras.length; i += 1) {
    cameras[i].disabled = seconds;
    cameras[i].lockOn = 0;
  }
}

/** How many cameras are currently locked on to the thief. */
export function lockedOnCount(cameras) {
  let count = 0;
  for (let i = 0; i < cameras.length; i += 1) if (cameras[i].lockOn >= 1) count += 1;
  return count;
}

/** How many cameras are dark right now (EMP active). */
export function disabledCount(cameras) {
  let count = 0;
  for (let i = 0; i < cameras.length; i += 1) if (cameras[i].disabled > 0) count += 1;
  return count;
}

/** The longest EMP time left on any camera, for the HUD countdown. */
export function empTimeLeft(cameras) {
  let best = 0;
  for (let i = 0; i < cameras.length; i += 1) best = Math.max(best, cameras[i].disabled);
  return best;
}
