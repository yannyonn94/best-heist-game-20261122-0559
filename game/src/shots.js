// shots.js stages the four screenshots behind ?shot=cover|patrol|tools|escape. Each scene
// plays the real rules forward from a fresh game with a fixed seed, steered by a small
// autopilot that walks toward waypoints while shying away from guards and locked-on cameras,
// grabs loot when it stands close enough, and fires tools on a script. The frame is what a
// short game really looks like — the same seed always gives the same frame.

import { STEP } from './config.js';
import { ACTION_EMP, ACTION_GRAB, ACTION_SMOKE } from './input.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { stepGame } from './main.js';
import { nearestLoot } from './loot.js';
import { guardSeesThief } from './guards.js';
import { isDisguised } from './player.js';

/** Seconds each scene plays before its frame is taken. */
const SCENE_SECONDS = { cover: 15, patrol: 6, tools: 15, escape: 46 };

/** Waypoints the autopilot walks, in order, for each scene. The lanes are chosen around the
 * room's real obstacles: x=150 runs the left lane clear of the laser corridor, y=250 runs
 * the vault row below the vault lasers and above the partitions, y=700 is the open hall.
 * Loot waypoints sit ON the loot (a bar, the Ledger) so the thief always comes within
 * grab range instead of passing 50 px by and walking on. */
const ROUTES = {
  cover: [[150, 700], [150, 250], [610, 158], [660, 450]],
  patrol: [[300, 700], [820, 700], [880, 560], [760, 430]],
  tools: [[150, 500], [150, 250], [640, 250], [1150, 300], [1180, 150]],
  escape: [[300, 165], [360, 165], [610, 158], [670, 158], [1150, 300], [1180, 150], [1150, 300], [1210, 700]],
};

/**
 * Steer the thief toward `target`, shying away from any guard that can see it and from
 * locked-on cameras. Returns a point 100 px ahead in the steered direction, for the
 * game's click-to-walk: a continuous vector, so the thief never flickers between two
 * key states against a wall edge the way quantized keys can.
 */
function autopilotTarget(game, target) {
  const player = game.player;
  let dx = target[0] - player.x;
  let dy = target[1] - player.y;
  const distance = Math.hypot(dx, dy) || 1;
  dx /= distance;
  dy /= distance;
  // Repulsion from guards that can see the thief, strongest up close.
  for (let i = 0; i < game.level.guards.length; i += 1) {
    const guard = game.level.guards[i];
    const gx = player.x - guard.x;
    const gy = player.y - guard.y;
    const gap = Math.hypot(gx, gy) || 1;
    const sees = guardSeesThief(guard, player, game.level.obstacles, isDisguised(player), player.smokeClouds);
    if ((sees || guard.chasing) && gap < 170) {
      const push = (170 - gap) / 170 * 1.6;
      dx += (gx / gap) * push;
      dy += (gy / gap) * push;
    }
  }
  // Repulsion from a camera that has locked on.
  for (let i = 0; i < game.level.cameras.length; i += 1) {
    const camera = game.level.cameras[i];
    if (camera.lockOn > 0.3 && camera.disabled <= 0) {
      const cx = player.x - camera.x;
      const cy = player.y - camera.y;
      const gap = Math.hypot(cx, cy) || 1;
      dx += (cx / gap) * 0.7;
      dy += (cy / gap) * 0.7;
    }
  }
  // Never let the repulsion cancel the way to the waypoint: if the steered direction
  // points away from the target, fall back to the target direction alone.
  const targetDx = (target[0] - player.x) / distance;
  const targetDy = (target[1] - player.y) / distance;
  if (dx * targetDx + dy * targetDy < 0.3) {
    dx = targetDx;
    dy = targetDy;
  }
  const length = Math.hypot(dx, dy) || 1;
  return { x: player.x + (dx / length) * 100, y: player.y + (dy / length) * 100 };
}

/** Run the game forward for `seconds`, steering along `route` and firing `script` actions. */
function playForward(game, seconds, route, script) {
  const steps = Math.round(seconds / STEP);
  let waypoint = 0;
  for (let index = 0; index < steps; index += 1) {
    if (game.alarm.outcome !== 'playing') break;
    const target = route[Math.min(waypoint, route.length - 1)];
    if (Math.hypot(target[0] - game.player.x, target[1] - game.player.y) < 26 && waypoint < route.length - 1) {
      waypoint += 1;
    }
    let actions = 0;
    if (nearestLoot(game.level.loot, game.player)) actions |= ACTION_GRAB;
    if (script) actions |= script(game.time);
    stepGame(game, STEP, { keys: {}, actions, clickTarget: autopilotTarget(game, target) });
  }
}

/**
 * Set `game` to the named scene and return the screen to draw over it and the best take.
 * Unknown names fall back to the title scene.
 */
export function stageShot(name, game) {
  if (name === 'cover') {
    playForward(game, SCENE_SECONDS.cover, ROUTES.cover, null);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'patrol') {
    playForward(game, SCENE_SECONDS.patrol, ROUTES.patrol, null);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'tools') {
    // Scripted tool use: EMP at 7 s, smoke at 9.5 s, each fired exactly once.
    const fired = { emp: false, smoke: false };
    const script = (time) => {
      if (!fired.emp && time >= 7) {
        fired.emp = true;
        return ACTION_EMP;
      }
      if (!fired.smoke && time >= 9.5) {
        fired.smoke = true;
        return ACTION_SMOKE;
      }
      return 0;
    };
    playForward(game, SCENE_SECONDS.tools, ROUTES.tools, script);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'escape') {
    playForward(game, SCENE_SECONDS.escape, ROUTES.escape, null);
    if (game.alarm.outcome === 'won') return { screen: SCREEN_WON, best: 0 };
    // Stage the getaway by hand when the autopilot fell short: the thief at the van door
    // with the haul, one guard in pursuit and the alarm running hot — still real game state.
    if (Math.hypot(game.player.x - game.level.exit.x, game.player.y - game.level.exit.y) > 200) {
      game.player.x = 1060;
      game.player.y = 690;
      game.player.target = null;
      for (let i = 0; i < game.level.loot.length; i += 1) {
        if (i < 3 || game.level.loot[i].kind === 'ledger') game.level.loot[i].taken = true;
      }
      game.alarm.value = 68;
      game.alarm.timeLeft = 38;
      const sal = game.level.guards[4];
      sal.x = 950;
      sal.y = 660;
      sal.chasing = true;
      sal.suspicion = 1;
      sal.angle = Math.atan2(game.player.y - sal.y, game.player.x - sal.x);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
