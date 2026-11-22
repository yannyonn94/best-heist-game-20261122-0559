// alarm.js is the heist's heartbeat: the alarm meter, the nerves, the 180-second clock and
// the question of whether the thief walks out rich or gets carried out. The alarm climbs
// while cameras and guards watch the thief and while lasers trip, and drains while the thief
// stays hidden — so patience is a real mechanic, not a waiting room. A catch costs a nerve
// and a chunk of alarm; three catches, a full alarm or an empty clock all end the night.

import {
  ALARM_CAUGHT, ALARM_CAMERA_RATE, ALARM_DECAY, ALARM_GUARD_RATE, ALARM_LASER_HIT,
  ALARM_MAX, NERVES_START, TIME_LIMIT,
} from './config.js';

/** Fresh alarm state: meter at 0, full nerves, full clock, no verdict yet. */
export function createAlarm() {
  return {
    value: 0,
    nerves: NERVES_START,
    timeLeft: TIME_LIMIT,
    /** 'playing' | 'won' | 'lost' */
    outcome: 'playing',
    /** Why the heist ended: 'escape' | 'caught' | 'lockdown' | 'time'. */
    reason: null,
    /** Seconds the thief has spent seen by at least one watcher, for the end screen. */
    secondsSeen: 0,
    /** How many times the thief has been caught. */
    catches: 0,
    /** How many laser beams the thief has tripped. */
    lasersTripped: 0,
  };
}

/**
 * Advance the alarm by `dt` seconds. `seen` counts how many watchers hold the thief right
 * now (cameras locked on + guards whose suspicion is climbing); `laserTrips` counts beams
 * tripped this step. Returns true while the heist is still on.
 */
export function stepAlarm(alarm, dt, seen, laserTrips) {
  if (alarm.outcome !== 'playing') return false;
  alarm.timeLeft -= dt;
  if (seen > 0) {
    alarm.secondsSeen += dt;
    alarm.value += (ALARM_CAMERA_RATE + ALARM_GUARD_RATE) * 0.12 * dt * seen;
  } else {
    alarm.value = Math.max(0, alarm.value - ALARM_DECAY * dt);
  }
  if (laserTrips > 0) {
    alarm.value += ALARM_LASER_HIT * laserTrips;
    alarm.lasersTripped += laserTrips;
  }
  alarm.value = Math.min(ALARM_MAX, alarm.value);
  if (alarm.value >= ALARM_MAX) {
    alarm.outcome = 'lost';
    alarm.reason = 'lockdown';
    return false;
  }
  if (alarm.timeLeft <= 0) {
    alarm.timeLeft = 0;
    alarm.outcome = 'lost';
    alarm.reason = 'time';
    return false;
  }
  return true;
}

/** A guard caught the thief: lose a nerve, alarm jumps, and the night may be over. */
export function registerCatch(alarm) {
  alarm.catches += 1;
  alarm.nerves -= 1;
  alarm.value = Math.min(ALARM_MAX, alarm.value + ALARM_CAUGHT);
  if (alarm.nerves <= 0) {
    alarm.outcome = 'lost';
    alarm.reason = 'caught';
  } else if (alarm.value >= ALARM_MAX) {
    alarm.outcome = 'lost';
    alarm.reason = 'lockdown';
  }
}

/** The thief reached the getaway door with loot: the heist is won. */
export function registerEscape(alarm) {
  if (alarm.outcome !== 'playing') return;
  alarm.outcome = 'won';
  alarm.reason = 'escape';
}

/** Alarm colour band for the HUD: 'calm' | 'warm' | 'hot' | 'critical'. */
export function alarmBand(value) {
  if (value < 30) return 'calm';
  if (value < 60) return 'warm';
  if (value < 85) return 'hot';
  return 'critical';
}

/** True when the alarm is high enough that the HUD should flash a warning. */
export function alarmFlashing(value) {
  return value >= 85;
}

/** Format seconds left as M:SS for the HUD clock. */
export function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}
