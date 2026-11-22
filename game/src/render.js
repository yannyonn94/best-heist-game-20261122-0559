// render.js paints the whole heist on one canvas: the green felt floor and gold trim of the
// Aurum Grand, the marble walls, the three gold vault doors, the gaming tables, the red laser
// beams, the sweeping camera cones, the guards' yellow vision cones, the loot, Marlowe the
// thief, and the HUD — alarm meter, clock, take, nerves and tools — across the top. Every
// colour is chosen so that safe cover, danger and loot are obvious at a glance, even when the
// screenshot is shrunk to a contact sheet.

import { ALARM_MAX, CAMERA, FLOOR, GUARD, HUD_HEIGHT, SMOKE_RADIUS, VIEW } from './config.js';
import { alarmBand, alarmFlashing, formatClock } from './alarm.js';
import { carriedValue, hasLedger } from './loot.js';
import { empTimeLeft } from './cameras.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WON = 'won';
export const SCREEN_LOST = 'lost';

const GOLD = '#e8b64c';
const GOLD_DARK = '#9a7420';
const FELT = '#0e3b2e';
const FELT_DARK = '#0a2c22';
const MARBLE = '#8d97a5';
const MARBLE_DARK = '#5d6774';
const NAVY = '#1c2b4a';
const RED = '#e5484d';
const CREAM = '#f5ead0';

/** Fit the 1280x800 logical canvas to the window, keeping the aspect ratio. */
export function createRenderer(canvas) {
  const context = canvas.getContext('2d');

  function resize() {
    const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    canvas.width = VIEW.width;
    canvas.height = VIEW.height;
    canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Draw one frame: the vault floor, everything on it, the HUD and any screen overlay. */
  function draw(view, screen) {
    context.clearRect(0, 0, VIEW.width, VIEW.height);
    drawFloor(context);
    drawDoors(context, view);
    drawObstacles(context, view.level);
    drawLasers(context, view.level.lasers);
    drawLoot(context, view.level.loot);
    drawSmoke(context, view.player.smokeClouds);
    drawCameras(context, view.level.cameras);
    drawGuards(context, view.level.guards);
    drawPlayer(context, view.player);
    drawHud(context, view);
    if (screen === SCREEN_TITLE) drawTitle(context, view.best);
    else if (screen === SCREEN_PAUSED) drawPaused(context);
    else if (screen === SCREEN_WON) drawEnd(context, view, true);
    else if (screen === SCREEN_LOST) drawEnd(context, view, false);
    if (view.message && view.messageUntil > view.time) drawMessage(context, view.message);
  }

  return { draw, resize };
}

/** The felt floor with a checker of deep green and a gold-trimmed border. */
function drawFloor(context) {
  context.fillStyle = FELT;
  context.fillRect(0, HUD_HEIGHT, VIEW.width, VIEW.height - HUD_HEIGHT);
  context.fillStyle = FELT_DARK;
  const size = 64;
  for (let y = HUD_HEIGHT; y < VIEW.height; y += size) {
    for (let x = 0; x < VIEW.width; x += size) {
      if (((x / size) + (y / size)) % 2 === 0) context.fillRect(x, y, size, size);
    }
  }
  // A red carpet runner down the grand hall, from the vaults to the getaway door.
  context.fillStyle = '#6e1423';
  context.fillRect(600, HUD_HEIGHT, 80, VIEW.height - HUD_HEIGHT);
  context.fillStyle = GOLD;
  context.fillRect(596, HUD_HEIGHT, 4, VIEW.height - HUD_HEIGHT);
  context.fillRect(680, HUD_HEIGHT, 4, VIEW.height - HUD_HEIGHT);
  // Gold trim around the floor edge.
  context.strokeStyle = GOLD;
  context.lineWidth = 3;
  context.strokeRect(8, HUD_HEIGHT + 8, VIEW.width - 16, VIEW.height - HUD_HEIGHT - 16);
}

/** The service door (entrance) and the getaway door (exit) along the bottom wall. */
function drawDoors(context, view) {
  const entrance = view.level.entrance;
  const exit = view.level.exitRect;
  context.fillStyle = '#3a4a2f';
  context.fillRect(entrance.x, entrance.y, entrance.width, entrance.height);
  context.fillStyle = CREAM;
  context.font = 'bold 13px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText('SERVICE DOOR', entrance.x + entrance.width / 2, entrance.y + 18);
  context.fillText('IN', entrance.x + entrance.width / 2, entrance.y + 36);
  const escaping = view.alarm.outcome === 'won';
  context.fillStyle = escaping ? '#2f9e44' : '#1f7a33';
  context.fillRect(exit.x, exit.y, exit.width, exit.height);
  context.strokeStyle = GOLD;
  context.lineWidth = 2;
  context.strokeRect(exit.x, exit.y, exit.width, exit.height);
  context.fillStyle = '#ffffff';
  context.fillText('GETAWAY', exit.x + exit.width / 2, exit.y + 18);
  context.fillText('VAN', exit.x + exit.width / 2, exit.y + 36);
}

/** Walls, vault doors and gaming tables. */
function drawObstacles(context, level) {
  for (let i = 0; i < level.obstacles.length; i += 1) {
    const obstacle = level.obstacles[i];
    if (obstacle.kind === 'vault') {
      // A gold vault door with black bars and a combination dial.
      const gradient = context.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.height);
      gradient.addColorStop(0, '#f6d47c');
      gradient.addColorStop(0.5, GOLD);
      gradient.addColorStop(1, GOLD_DARK);
      context.fillStyle = gradient;
      context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      context.strokeStyle = '#5c430f';
      context.lineWidth = 3;
      context.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      context.strokeStyle = '#3a2c08';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(obstacle.x + 20, obstacle.y);
      context.lineTo(obstacle.x + 20, obstacle.y + obstacle.height);
      context.moveTo(obstacle.x + 80, obstacle.y);
      context.lineTo(obstacle.x + 80, obstacle.y + obstacle.height);
      context.stroke();
      context.fillStyle = '#3a2c08';
      context.beginPath();
      context.arc(obstacle.x + 50, obstacle.y + obstacle.height / 2, 9, 0, Math.PI * 2);
      context.fill();
    } else if (obstacle.kind === 'table') {
      context.fillStyle = '#14532d';
      context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      context.strokeStyle = GOLD;
      context.lineWidth = 2;
      context.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      context.fillStyle = 'rgba(232, 182, 76, 0.25)';
      context.beginPath();
      context.ellipse(
        obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2,
        obstacle.width / 3, obstacle.height / 3, 0, 0, Math.PI * 2,
      );
      context.fill();
    } else {
      context.fillStyle = MARBLE;
      context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      context.fillStyle = MARBLE_DARK;
      context.fillRect(obstacle.x, obstacle.y, obstacle.width, 4);
      context.strokeStyle = GOLD_DARK;
      context.lineWidth = 1;
      context.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }
  }
}

/** The 12 red laser beams, glowing; a tripped beam flashes white while it cools down. */
function drawLasers(context, lasers) {
  for (let i = 0; i < lasers.length; i += 1) {
    const beam = lasers[i];
    context.save();
    context.strokeStyle = beam.cooldown > 0 ? '#ffffff' : RED;
    context.lineWidth = 3;
    context.shadowColor = RED;
    context.shadowBlur = beam.cooldown > 0 ? 18 : 8;
    context.beginPath();
    context.moveTo(beam.x1, beam.y1);
    context.lineTo(beam.x2, beam.y2);
    context.stroke();
    context.restore();
    // Emitter boxes at both ends.
    context.fillStyle = '#2b2f36';
    context.fillRect(beam.x1 - 4, beam.y1 - 4, 8, 8);
    context.fillRect(beam.x2 - 4, beam.y2 - 4, 8, 8);
    context.fillStyle = RED;
    context.beginPath();
    context.arc(beam.x1, beam.y1, 2, 0, Math.PI * 2);
    context.arc(beam.x2, beam.y2, 2, 0, Math.PI * 2);
    context.fill();
  }
}

/** Gold bars glow on the floor; the Ledger is a cream book on the manager's desk. */
function drawLoot(context, loot) {
  for (let i = 0; i < loot.length; i += 1) {
    const item = loot[i];
    if (item.taken) continue;
    if (item.kind === 'gold') {
      context.save();
      context.shadowColor = GOLD;
      context.shadowBlur = 14;
      context.fillStyle = '#ffd970';
      context.fillRect(item.x - 11, item.y - 6, 22, 12);
      context.fillStyle = GOLD;
      context.fillRect(item.x - 11, item.y + 1, 22, 5);
      context.strokeStyle = '#7a5a10';
      context.lineWidth = 1;
      context.strokeRect(item.x - 11, item.y - 6, 22, 12);
      context.restore();
      context.fillStyle = '#fff3c4';
      context.fillRect(item.x - 8, item.y - 4, 5, 3);
    } else {
      // The Casino Ledger: a book with a red seal, on a desk drawn beneath it.
      context.fillStyle = '#6b4f2a';
      context.fillRect(item.x - 26, item.y - 14, 52, 28);
      context.fillStyle = CREAM;
      context.fillRect(item.x - 20, item.y - 10, 40, 20);
      context.strokeStyle = '#8a6d3b';
      context.lineWidth = 2;
      context.strokeRect(item.x - 20, item.y - 10, 40, 20);
      context.fillStyle = '#8a6d3b';
      context.fillRect(item.x - 14, item.y - 5, 28, 2);
      context.fillRect(item.x - 14, item.y + 1, 28, 2);
      context.fillRect(item.x - 14, item.y + 7, 18, 2);
      context.fillStyle = RED;
      context.beginPath();
      context.arc(item.x + 12, item.y + 6, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = GOLD;
      context.font = 'bold 11px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('LEDGER', item.x, item.y - 20);
    }
  }
}

/** Smoke clouds: soft grey puffs that hide the thief inside them. */
function drawSmoke(context, clouds) {
  for (let i = 0; i < clouds.length; i += 1) {
    const cloud = clouds[i];
    context.save();
    context.globalAlpha = 0.55;
    context.fillStyle = '#b8bcc4';
    context.beginPath();
    context.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.35;
    context.beginPath();
    context.arc(cloud.x - 22, cloud.y + 10, cloud.radius * 0.6, 0, Math.PI * 2);
    context.arc(cloud.x + 24, cloud.y - 8, cloud.radius * 0.55, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

/** A vision cone: a translucent wedge from the watcher toward where it faces. */
function drawCone(context, x, y, angle, range, halfAngle, colour) {
  context.save();
  context.fillStyle = colour;
  context.beginPath();
  context.moveTo(x, y);
  context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  context.closePath();
  context.fill();
  context.restore();
}

/** The 8 cameras: wall boxes with a red lens, sweeping red cones; dark when EMP'd. */
function drawCameras(context, cameras) {
  for (let i = 0; i < cameras.length; i += 1) {
    const camera = cameras[i];
    const disabled = camera.disabled > 0;
    if (!disabled) {
      const colour = camera.lockOn >= 1 ? 'rgba(229, 72, 77, 0.34)' : 'rgba(229, 72, 77, 0.20)';
      drawCone(context, camera.x, camera.y, camera.angle, CAMERA.coneRange, CAMERA.coneHalfAngle, colour);
    }
    context.fillStyle = disabled ? '#3a3f47' : '#22262d';
    context.fillRect(camera.x - 9, camera.y - 7, 18, 14);
    context.strokeStyle = GOLD_DARK;
    context.lineWidth = 1;
    context.strokeRect(camera.x - 9, camera.y - 7, 18, 14);
    context.fillStyle = disabled ? '#555b66' : RED;
    context.beginPath();
    context.arc(camera.x + Math.cos(camera.angle) * 6, camera.y + Math.sin(camera.angle) * 6, 4, 0, Math.PI * 2);
    context.fill();
    if (camera.lockOn > 0 && !disabled) {
      context.fillStyle = '#ffffff';
      context.font = 'bold 11px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('!', camera.x, camera.y - 14);
    }
  }
}

/** The 5 guards: navy uniforms with caps, yellow vision cones, suspicion rings above. */
function drawGuards(context, guards) {
  for (let i = 0; i < guards.length; i += 1) {
    const guard = guards[i];
    const coneColour = guard.chasing
      ? 'rgba(229, 72, 77, 0.34)'
      : 'rgba(232, 182, 76, 0.24)';
    drawCone(context, guard.x, guard.y, guard.angle, GUARD.coneRange, GUARD.coneHalfAngle, coneColour);
    // Body: navy circle with a gold belt line.
    context.fillStyle = NAVY;
    context.beginPath();
    context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = GOLD;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    context.stroke();
    // Cap brim pointing where the guard faces.
    context.fillStyle = '#0f1830';
    context.beginPath();
    context.arc(
      guard.x + Math.cos(guard.angle) * 8, guard.y + Math.sin(guard.angle) * 8, 6, 0, Math.PI * 2,
    );
    context.fill();
    // Face dot and shoulders.
    context.fillStyle = '#e8c39e';
    context.beginPath();
    context.arc(guard.x + Math.cos(guard.angle) * 4, guard.y + Math.sin(guard.angle) * 4, 4, 0, Math.PI * 2);
    context.fill();
    // Suspicion ring: fills from grey to red as the guard grows sure.
    if (guard.suspicion > 0.05) {
      context.strokeStyle = guard.suspicion >= 1 ? RED : '#f5c542';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius + 7, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      context.stroke();
    }
    if (guard.chasing) {
      context.fillStyle = '#ffffff';
      context.font = 'bold 12px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('!', guard.x, guard.y - GUARD.radius - 12);
    }
    context.fillStyle = CREAM;
    context.font = '11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(guard.name, guard.x, guard.y + GUARD.radius + 14);
  }
}

/** Marlowe the thief: a black figure with a gold-trimmed hat, facing where it walks. */
function drawPlayer(context, player) {
  const bob = player.moving ? Math.sin(player.walkPhase) * 2 : 0;
  context.save();
  context.translate(player.x, player.y + bob * 0.3);
  // Shadow.
  context.fillStyle = 'rgba(0, 0, 0, 0.35)';
  context.beginPath();
  context.ellipse(0, 10, 12, 5, 0, 0, Math.PI * 2);
  context.fill();
  // Body and gold sash, with a soft gold glow so the thief reads against the dark felt.
  context.save();
  context.shadowColor = GOLD;
  context.shadowBlur = 14;
  context.fillStyle = '#14161c';
  context.beginPath();
  context.arc(0, 0, player.radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.strokeStyle = GOLD;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, player.radius, 0, Math.PI * 2);
  context.stroke();
  // Hat: a wide brim in the facing direction.
  context.fillStyle = '#14161c';
  context.beginPath();
  context.ellipse(Math.cos(player.facing) * 5, Math.sin(player.facing) * 5, 10, 7, player.facing, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = GOLD;
  context.lineWidth = 1.5;
  context.beginPath();
  context.ellipse(Math.cos(player.facing) * 5, Math.sin(player.facing) * 5, 10, 7, player.facing, 0, Math.PI * 2);
  context.stroke();
  // Eyes: two gold dots.
  context.fillStyle = GOLD;
  context.beginPath();
  context.arc(Math.cos(player.facing) * 6 - Math.sin(player.facing) * 3, Math.sin(player.facing) * 6 + Math.cos(player.facing) * 3, 1.8, 0, Math.PI * 2);
  context.arc(Math.cos(player.facing) * 6 + Math.sin(player.facing) * 3, Math.sin(player.facing) * 6 - Math.cos(player.facing) * 3, 1.8, 0, Math.PI * 2);
  context.fill();
  context.restore();
  if (player.disguiseTime > 0) {
    context.fillStyle = '#ffffff';
    context.font = 'bold 11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(`STAFF ${Math.ceil(player.disguiseTime)}s`, player.x, player.y - 22);
  }
}

/** The HUD bar: title, alarm meter, clock, take, nerves and the three tool buttons. */
function drawHud(context, view) {
  const alarm = view.alarm;
  const player = view.player;
  context.fillStyle = '#101623';
  context.fillRect(0, 0, VIEW.width, HUD_HEIGHT);
  context.fillStyle = GOLD;
  context.fillRect(0, HUD_HEIGHT - 3, VIEW.width, 3);

  // Title block.
  context.fillStyle = GOLD;
  context.font = 'bold 22px system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillText('THE GILDED VAULT', 16, 28);
  context.fillStyle = '#9aa5b5';
  context.font = '11px system-ui, sans-serif';
  context.fillText('Aurum Grand Casino  •  5 guards  •  8 cameras  •  12 lasers', 16, 50);

  // Alarm meter.
  const meterX = 350;
  const meterY = 18;
  const meterWidth = 220;
  const band = alarmBand(alarm.value);
  const flashing = alarmFlashing(alarm.value) && Math.floor(view.time * 4) % 2 === 0;
  context.fillStyle = '#c8ccd4';
  context.font = 'bold 13px system-ui, sans-serif';
  context.fillText('ALARM', meterX, meterY + 11);
  context.fillStyle = '#2a3140';
  context.fillRect(meterX + 62, meterY, meterWidth, 18);
  const fillColour = band === 'calm' ? '#2f9e44' : band === 'warm' ? '#f5c542' : band === 'hot' ? '#f08c00' : RED;
  context.fillStyle = flashing ? '#ffffff' : fillColour;
  context.fillRect(meterX + 62, meterY, Math.max(0, (meterWidth * alarm.value) / ALARM_MAX), 18);
  context.strokeStyle = GOLD_DARK;
  context.lineWidth = 1;
  context.strokeRect(meterX + 62, meterY, meterWidth, 18);
  context.fillStyle = '#ffffff';
  context.font = 'bold 13px system-ui, sans-serif';
  context.fillText(`${Math.round(alarm.value)}%`, meterX + 62 + meterWidth + 10, meterY + 14);
  context.fillStyle = '#9aa5b5';
  context.font = '11px system-ui, sans-serif';
  context.fillText(band === 'calm' ? 'quiet' : band === 'warm' ? 'warming up' : band === 'hot' ? 'HOT — hide!' : 'LOCKDOWN SOON', meterX, meterY + 34);

  // Clock.
  context.fillStyle = alarm.timeLeft < 30 ? RED : CREAM;
  context.font = 'bold 26px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(formatClock(alarm.timeLeft), 730, 34);
  context.fillStyle = '#9aa5b5';
  context.font = '11px system-ui, sans-serif';
  context.fillText('TO GETAWAY', 730, 52);

  // Take and nerves.
  context.fillStyle = GOLD;
  context.font = 'bold 20px system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillText(`$${carriedValue(view.level.loot).toLocaleString('en-US')}`, 795, 30);
  context.fillStyle = '#9aa5b5';
  context.font = '11px system-ui, sans-serif';
  context.fillText(hasLedger(view.level.loot) ? 'take • LEDGER ✓' : 'take', 795, 50);
  context.font = '20px system-ui, sans-serif';
  for (let i = 0; i < 3; i += 1) {
    context.fillStyle = i < alarm.nerves ? RED : '#3a4152';
    context.fillText('♥', 925 + i * 24, 32);
  }
  context.fillStyle = '#9aa5b5';
  context.font = '11px system-ui, sans-serif';
  context.fillText('nerves', 925, 52);

  // Tool buttons: 1 EMP ($400), 2 smoke (x3), 3 disguise (x2).
  drawToolButton(context, 1010, 10, '1', 'EMP', player.empTime > 0 ? `${Math.ceil(player.empTime)}s` : '$400', player.empTime > 0);
  drawToolButton(context, 1090, 10, '2', 'SMOKE', `x${player.smokeLeft}`, player.smokeLeft <= 0);
  drawToolButton(context, 1170, 10, '3', 'DISGUISE', `x${player.disguiseLeft}`, player.disguiseLeft <= 0);
  const empLeft = empTimeLeft(view.level.cameras);
  if (empLeft > 0) {
    context.fillStyle = '#7dd3fc';
    context.font = 'bold 12px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(`CAMERAS DARK ${Math.ceil(empLeft)}s`, 1130, 66);
  }
}

/** One HUD tool button. */
function drawToolButton(context, x, y, key, label, detail, active) {
  context.fillStyle = active ? '#2a4a6b' : '#1c2436';
  context.fillRect(x, y, 72, 46);
  context.strokeStyle = active ? '#7dd3fc' : GOLD_DARK;
  context.lineWidth = 1.5;
  context.strokeRect(x, y, 72, 46);
  context.fillStyle = CREAM;
  context.font = 'bold 13px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(`${key} ${label}`, x + 36, y + 18);
  context.fillStyle = '#9aa5b5';
  context.font = '11px system-ui, sans-serif';
  context.fillText(detail, x + 36, y + 36);
}

/** A floating message line (pickup, chase warning, tool used) above the floor. */
function drawMessage(context, message) {
  context.save();
  context.font = 'bold 18px system-ui, sans-serif';
  context.textAlign = 'center';
  const width = context.measureText(message).width + 32;
  context.fillStyle = 'rgba(16, 22, 35, 0.88)';
  context.fillRect((VIEW.width - width) / 2, HUD_HEIGHT + 12, width, 34);
  context.strokeStyle = GOLD;
  context.lineWidth = 1;
  context.strokeRect((VIEW.width - width) / 2, HUD_HEIGHT + 12, width, 34);
  context.fillStyle = CREAM;
  context.fillText(message, VIEW.width / 2, HUD_HEIGHT + 35);
  context.restore();
}

/** The title screen: the pitch, the numbers, the controls. */
function drawTitle(context, best) {
  context.save();
  context.fillStyle = 'rgba(8, 12, 20, 0.82)';
  context.fillRect(0, 0, VIEW.width, VIEW.height);
  context.textAlign = 'center';
  context.fillStyle = GOLD;
  context.font = 'bold 64px Georgia, serif';
  context.fillText('THE GILDED VAULT', VIEW.width / 2, 200);
  context.fillStyle = CREAM;
  context.font = '22px Georgia, serif';
  context.fillText('A casino heist in 180 seconds', VIEW.width / 2, 240);
  context.font = '17px system-ui, sans-serif';
  context.fillStyle = '#c8ccd4';
  context.fillText('Marlowe slips into the Aurum Grand at midnight. Six gold bars wait in three vaults —', VIEW.width / 2, 300);
  context.fillText('but the gold is the decoy. The real score is the Casino Ledger in the manager’s office.', VIEW.width / 2, 326);
  context.fillStyle = GOLD;
  context.font = 'bold 17px system-ui, sans-serif';
  context.fillText('5 guards  •  8 cameras  •  12 laser grids  •  3 vaults  •  180 seconds', VIEW.width / 2, 372);
  context.fillStyle = '#c8ccd4';
  context.font = '16px system-ui, sans-serif';
  context.fillText('WASD / arrows or click to move  •  SPACE or E to grab loot  •  1 EMP ($400)  •  2 smoke bomb  •  3 disguise ($300)', VIEW.width / 2, 420);
  context.fillText('Guards and cameras build suspicion before they catch you — watch the cones, mind the alarm,', VIEW.width / 2, 448);
  context.fillText('grab the loot and reach the GETAWAY VAN door before the clock runs out.', VIEW.width / 2, 474);
  if (best > 0) {
    context.fillStyle = GOLD;
    context.font = 'bold 18px system-ui, sans-serif';
    context.fillText(`Best take so far: $${best.toLocaleString('en-US')}`, VIEW.width / 2, 520);
  }
  context.fillStyle = '#ffffff';
  context.font = 'bold 24px system-ui, sans-serif';
  context.fillText('Press SPACE or click to start the heist', VIEW.width / 2, 580);
  context.restore();
}

/** The pause overlay. */
function drawPaused(context) {
  context.save();
  context.fillStyle = 'rgba(8, 12, 20, 0.72)';
  context.fillRect(0, 0, VIEW.width, VIEW.height);
  context.fillStyle = CREAM;
  context.font = 'bold 48px Georgia, serif';
  context.textAlign = 'center';
  context.fillText('PAUSED', VIEW.width / 2, 380);
  context.font = '18px system-ui, sans-serif';
  context.fillText('Press P or Escape to slip back into the shadows.', VIEW.width / 2, 420);
  context.restore();
}

/** The end screen: won (the getaway pays off) or lost (caught, locked down, or out of time). */
function drawEnd(context, view, won) {
  const alarm = view.alarm;
  const loot = view.level.loot;
  const take = carriedValue(loot);
  const timeBonus = won ? Math.round(alarm.timeLeft) * 10 : 0;
  const total = Math.max(0, take - view.player.toolSpend + timeBonus);
  context.save();
  context.fillStyle = 'rgba(8, 12, 20, 0.85)';
  context.fillRect(0, 0, VIEW.width, VIEW.height);
  context.textAlign = 'center';
  if (won) {
    context.fillStyle = GOLD;
    context.font = 'bold 56px Georgia, serif';
    context.fillText('CLEAN GETAWAY!', VIEW.width / 2, 220);
    context.fillStyle = CREAM;
    context.font = '20px Georgia, serif';
    context.fillText('Marlowe melts into the night as the van pulls away.', VIEW.width / 2, 258);
  } else {
    context.fillStyle = RED;
    context.font = 'bold 56px Georgia, serif';
    const heading = alarm.reason === 'caught' ? 'CAUGHT!' : alarm.reason === 'lockdown' ? 'LOCKDOWN!' : 'OUT OF TIME!';
    context.fillText(heading, VIEW.width / 2, 220);
    context.fillStyle = CREAM;
    context.font = '20px Georgia, serif';
    const line = alarm.reason === 'caught'
      ? 'Three strikes — the crew walks away empty-handed.'
      : alarm.reason === 'lockdown'
        ? 'The vault sealed itself with Marlowe inside.'
        : 'The getaway van left without its thief.';
    context.fillText(line, VIEW.width / 2, 258);
  }
  context.fillStyle = '#c8ccd4';
  context.font = '18px system-ui, sans-serif';
  const rows = [
    `Loot carried: $${take.toLocaleString('en-US')}${hasLedger(loot) ? '  (Ledger ✓)' : ''}`,
    `Tools spent: -$${view.player.toolSpend.toLocaleString('en-US')}`,
    won ? `Time bonus: +$${timeBonus.toLocaleString('en-US')} (${Math.round(alarm.timeLeft)}s left)` : `Seconds seen: ${Math.round(alarm.secondsSeen)}s  •  Lasers tripped: ${alarm.lasersTripped}`,
    won ? `FINAL TAKE: $${total.toLocaleString('en-US')}` : 'Final take: $0 — the house keeps it all.',
  ];
  rows.forEach((row, index) => {
    context.fillStyle = index === rows.length - 1 ? GOLD : '#c8ccd4';
    context.font = index === rows.length - 1 ? 'bold 24px system-ui, sans-serif' : '18px system-ui, sans-serif';
    context.fillText(row, VIEW.width / 2, 320 + index * 36);
  });
  if (won && total > view.best) {
    context.fillStyle = GOLD;
    context.font = 'bold 18px system-ui, sans-serif';
    context.fillText('NEW BEST TAKE!', VIEW.width / 2, 480);
  }
  context.fillStyle = '#ffffff';
  context.font = 'bold 22px system-ui, sans-serif';
  context.fillText('Press SPACE or click to run it back', VIEW.width / 2, 560);
  context.restore();
}
