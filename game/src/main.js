// main.js boots the heist and runs the one loop. The game moves between five screens —
// title, play, paused, won and lost — and advances in fixed 1/60 s steps. All of the rules
// live in stepGame, which the live loop, the screenshot autopilot and a play-test harness
// all call, so a staged screenshot is a real game state, never a painting.
//
// ?seed=N fixes the small random jitters. ?shot=cover|patrol|tools|escape (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets window.__shotReady.

import { BEST_KEY, LOOT, STEP } from './config.js';
import { createRandom } from './random.js';
import { createLevel } from './level.js';
import { createPlayer, isDisguised, stepPlayer, useTool } from './player.js';
import { resetGuards, stepGuard } from './guards.js';
import { disableAllCameras, stepCamera } from './cameras.js';
import { carriedValue, tryGrabLoot } from './loot.js';
import { createAlarm, registerCatch, registerEscape, stepAlarm } from './alarm.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM, ACTION_DISGUISE, ACTION_EMP, ACTION_GRAB, ACTION_PAUSE, ACTION_SMOKE,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_LOST, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

/** Distance from the getaway door's centre that counts as reaching it. */
const EXIT_REACH = 46;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

/** Distance from a point to a segment — used to test whether the thief crossed a laser. */
export function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  return Math.hypot(px - nearestX, py - nearestY);
}

/**
 * Fresh heist state. The seed jitters guard pauses and camera phases a little, so every
 * visit starts slightly differently while a ?shot= scene stays reproducible.
 */
export function createGame(seedValue) {
  const random = createRandom(seedValue);
  const level = createLevel();
  for (let i = 0; i < level.guards.length; i += 1) level.guards[i].wait = random.range(0, 1);
  for (let i = 0; i < level.cameras.length; i += 1) level.cameras[i].phase += random.range(-0.2, 0.2);
  return {
    seed: seedValue,
    level,
    player: createPlayer(level.spawn.x, level.spawn.y),
    alarm: createAlarm(),
    time: 0,
    best: 0,
    message: '',
    messageUntil: 0,
    events: [],
  };
}

/** Show a floating message above the floor for `seconds`. */
function flashMessage(game, text, seconds) {
  game.message = text;
  game.messageUntil = game.time + seconds;
}

/**
 * Advance the heist by `dt` seconds. `input` is { keys, actions, clickTarget }.
 * Events ('pickup', 'laser', 'emp', 'smoke', 'disguise', 'spotted', 'caught', 'win',
 * 'lose', 'empty') are pushed onto game.events for the loop to turn into sounds.
 */
export function stepGame(game, dt, input) {
  const { level, player, alarm } = game;
  if (alarm.outcome !== 'playing') return;
  game.time += dt;

  // Tools first: the EMP, the smoke bomb and the disguise.
  if (input.actions & ACTION_EMP) {
    const result = useTool(player, 'emp', level.cameras, disableAllCameras);
    if (result === 'emp') {
      game.events.push('emp');
      flashMessage(game, 'EMP burst — all 8 cameras dark for 10s (−$400)', 2.5);
    }
  }
  if (input.actions & ACTION_SMOKE) {
    const result = useTool(player, 'smoke', level.cameras, disableAllCameras);
    if (result === 'smoke') {
      game.events.push('smoke');
      flashMessage(game, 'Smoke bomb — hidden for 6 seconds', 2);
    } else if (result === 'empty') {
      game.events.push('empty');
      flashMessage(game, 'No smoke bombs left!', 1.5);
    }
  }
  if (input.actions & ACTION_DISGUISE) {
    const result = useTool(player, 'disguise', level.cameras, disableAllCameras);
    if (result === 'disguise') {
      game.events.push('disguise');
      flashMessage(game, 'Disguise on — guards see staff for 8s (−$300)', 2.5);
    } else if (result === 'empty') {
      game.events.push('empty');
      flashMessage(game, 'No disguises left!', 1.5);
    }
  }

  // Walk.
  if (input.clickTarget) player.target = input.clickTarget;
  stepPlayer(player, dt, input.keys, level.loot, level.obstacles);

  // Grab loot.
  if (input.actions & ACTION_GRAB) {
    const grabbed = tryGrabLoot(level.loot, player);
    if (grabbed) {
      game.events.push(grabbed.kind === 'ledger' ? 'pickup-ledger' : 'pickup');
      flashMessage(
        game,
        grabbed.kind === 'ledger'
          ? 'THE LEDGER! $1,500 — the real score. Now get out!'
          : `Gold bar pocketed — $${grabbed.value.toLocaleString('en-US')}`,
        2,
      );
    }
  }

  // Guards: patrol, suspect, chase, catch.
  const disguised = isDisguised(player);
  let guardSees = 0;
  for (let i = 0; i < level.guards.length; i += 1) {
    const guard = level.guards[i];
    const chaseEvents = [];
    const caught = stepGuard(guard, dt, player, level.obstacles, disguised, player.smokeClouds, chaseEvents);
    if (chaseEvents.length > 0) {
      game.events.push('spotted');
      flashMessage(game, `${guard.name} is onto you — break line of sight!`, 2);
    }
    if (guard.suspicion > 0.3) guardSees += 1;
    if (caught === 'caught') {
      registerCatch(alarm);
      game.events.push('caught');
      if (alarm.outcome === 'playing') {
        flashMessage(game, `Caught by ${guard.name}! A nerve gone — back to the service door.`, 2.5);
        player.x = level.spawn.x;
        player.y = level.spawn.y;
        player.target = null;
        resetGuards(level.guards);
      }
    }
  }

  // Cameras: sweep and lock on.
  let camerasLocked = 0;
  for (let i = 0; i < level.cameras.length; i += 1) {
    if (stepCamera(level.cameras[i], dt, game.time, player, level.obstacles, player.smokeClouds)) camerasLocked += 1;
  }

  // Lasers: crossing a beam trips the alarm and the beam sleeps briefly.
  let laserTrips = 0;
  for (let i = 0; i < level.lasers.length; i += 1) {
    const beam = level.lasers[i];
    if (beam.cooldown > 0) {
      beam.cooldown = Math.max(0, beam.cooldown - dt);
      continue;
    }
    if (distancePointToSegment(player.x, player.y, beam.x1, beam.y1, beam.x2, beam.y2) < player.radius + 2) {
      beam.cooldown = 2.5;
      beam.tripped = true;
      laserTrips += 1;
      game.events.push('laser');
      flashMessage(game, 'Laser tripped! Alarm +12', 1.5);
    }
  }

  // The alarm: climbs while watched, drains while hidden.
  const seen = camerasLocked + guardSees;
  stepAlarm(alarm, dt, seen, laserTrips);
  if (alarm.outcome === 'lost') {
    game.events.push('lose');
    return;
  }

  // The getaway: reach the van door carrying loot.
  const exit = level.exit;
  if (Math.hypot(player.x - exit.x, player.y - exit.y) < EXIT_REACH && carriedValue(level.loot) > 0) {
    registerEscape(alarm);
    game.events.push('win');
  }
}

/** Final score: loot minus tool spend plus the time bonus, never below zero. */
export function finalScore(game) {
  const take = carriedValue(game.level.loot);
  const timeBonus = Math.round(game.alarm.timeLeft) * LOOT.timeBonusPerSecond;
  return Math.max(0, take - game.player.toolSpend + timeBonus);
}

/** The HUD tool buttons' rectangles, so a mouse click on one fires that tool. */
const TOOL_BUTTONS = [
  { x: 1010, y: 10, width: 72, height: 46, action: ACTION_EMP },
  { x: 1090, y: 10, width: 72, height: 46, action: ACTION_SMOKE },
  { x: 1170, y: 10, width: 72, height: 46, action: ACTION_DISGUISE },
];

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best take then lasts this visit only.
  }
}

/** Play the sounds queued by the last step. */
function playEvents(events) {
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event === 'pickup') audio.pickup(false);
    else if (event === 'pickup-ledger') audio.pickup(true);
    else if (event === 'laser') audio.laser();
    else if (event === 'emp') audio.emp();
    else if (event === 'smoke') audio.smoke();
    else if (event === 'disguise') audio.disguise();
    else if (event === 'spotted') audio.spotted();
    else if (event === 'caught') audio.caught();
    else if (event === 'win') audio.win();
    else if (event === 'lose') audio.lose();
  }
  events.length = 0;
}

/** A staged screenshot scene: paint it twice and tell the screenshot runner it is ready. */
function runShot(name) {
  const scene = stageShot(name, game);
  game.best = scene.best;
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** The live game: title, play, pause, win and lose, with keyboard and mouse. */
function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  game.best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    const fresh = createGame(Math.floor(Math.random() * 4294967296));
    game.level = fresh.level;
    game.player = fresh.player;
    game.alarm = fresh.alarm;
    game.time = 0;
    game.message = '';
    game.messageUntil = 0;
    game.events.length = 0;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. 180 seconds. Grab the loot and reach the getaway van.');
  }

  function endGame() {
    if (game.alarm.outcome === 'won') {
      screen = SCREEN_WON;
      const score = finalScore(game);
      if (score > game.best) {
        game.best = score;
        saveBest(score);
      }
      announce(`Clean getaway! Final take $${score.toLocaleString('en-US')}.`);
    } else {
      screen = SCREEN_LOST;
      const reason = game.alarm.reason === 'caught' ? 'Caught three times.' : game.alarm.reason === 'lockdown' ? 'The vault locked down.' : 'Out of time.';
      announce(`Heist failed. ${reason}`);
    }
  }

  /** A click inside a HUD tool button fires that tool; anywhere else sets a walk target. */
  function routeClick(click) {
    if (!click) return null;
    if (click.y < 72) {
      for (let i = 0; i < TOOL_BUTTONS.length; i += 1) {
        const button = TOOL_BUTTONS[i];
        if (click.x >= button.x && click.x <= button.x + button.width && click.y >= button.y && click.y <= button.y + button.height) {
          return { action: button.action, target: null };
        }
      }
    }
    return { action: 0, target: click };
  }

  function handleActions() {
    let actions = input.takeActions();
    const hadClick = input.clickTarget !== null;
    const routed = routeClick(input.clickTarget);
    if (routed) {
      actions |= routed.action;
      input.clickTarget = routed.target;
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE || screen === SCREEN_WON || screen === SCREEN_LOST) {
      if (actions & ACTION_CONFIRM || hadClick) {
        input.clickTarget = null;
        startGame();
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (actions) {
      const keys = input.keys;
      stepGame(game, STEP, { keys, actions, clickTarget: null });
      playEvents(game.events);
      audio.setAlarmHot(game.alarm.value >= 60);
      if (game.alarm.outcome !== 'playing') endGame();
    }
  }

  function step() {
    // On the title screen the guards patrol behind the overlay, so the room is alive.
    if (screen === SCREEN_TITLE) {
      for (let i = 0; i < game.level.guards.length; i += 1) {
        stepGuard(game.level.guards[i], STEP, game.player, game.level.obstacles, false, [], []);
      }
      for (let i = 0; i < game.level.cameras.length; i += 1) {
        stepCamera(game.level.cameras[i], STEP, game.time, game.player, game.level.obstacles, []);
      }
      game.time += STEP;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    stepGame(game, STEP, { keys: input.keys, actions: 0, clickTarget: null });
    playEvents(game.events);
    audio.setAlarmHot(game.alarm.value >= 60);
    if (game.alarm.outcome !== 'playing') endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(game, screen);
  }

  // Leaving the tab pauses a running game rather than letting the clock run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Gilded Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
