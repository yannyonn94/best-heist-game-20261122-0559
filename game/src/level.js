// level.js builds the Aurum Grand casino vault: one big floor the thief must cross, with
// three gold vaults along the top wall, the manager's office (and its Ledger) top-right, a
// laser-guarded service corridor down the left, and gaming tables for cover in the middle.
// Everything here is pure data and geometry — no drawing, no input — so the same layout can
// be driven by the game, the screenshot autopilot and the play-test harness alike.
//
// The floor is 1280 x 728, starting below the 72 px HUD bar. Walls and tables block movement
// AND sight; lasers and cameras watch the gaps between them. Three routes cross the room:
// the grand hall (guarded), the service corridor (lasers), and the office wing (cameras).

import { ENTRANCE, EXIT, FLOOR } from './config.js';

/** A wall or table: { x, y, width, height, kind: 'wall' | 'table' | 'vault' | 'desk' }. */
function rect(x, y, width, height, kind) {
  return { x, y, width, height, kind };
}

/** True when the point (px, py) lies inside the rectangle. */
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

/** True when a circle of radius `radius` at (cx, cy) overlaps the rectangle. */
export function circleHitsRect(cx, cy, radius, r) {
  const nearestX = Math.max(r.x, Math.min(cx, r.x + r.width));
  const nearestY = Math.max(r.y, Math.min(cy, r.y + r.height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

/** Segment (x1,y1)-(x2,y2) against one rectangle edge; standard orientation test. */
function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** True when the segment crosses the rectangle or either end sits inside it. */
export function segmentHitsRect(x1, y1, x2, y2, r) {
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  const left = r.x;
  const right = r.x + r.width;
  const top = r.y;
  const bottom = r.y + r.height;
  return (
    segmentsCross(x1, y1, x2, y2, left, top, right, top) ||
    segmentsCross(x1, y1, x2, y2, right, top, right, bottom) ||
    segmentsCross(x1, y1, x2, y2, right, bottom, left, bottom) ||
    segmentsCross(x1, y1, x2, y2, left, bottom, left, top)
  );
}

/** True when any obstacle blocks the line of sight from (x1, y1) to (x2, y2). */
export function lineBlocked(x1, y1, x2, y2, obstacles) {
  for (let i = 0; i < obstacles.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, obstacles[i])) return true;
  }
  return false;
}

/**
 * Move a circle by (dx, dy), sliding along obstacles: try x first, then y, and keep whichever
 * axis is free. When the direct move stalls completely (pushing straight into a wall or table
 * edge), try the displacement rotated by 45 and 90 degrees, so the thief slides along the
 * obstacle instead of standing stuck against it. Returns the new position.
 */
export function moveCircle(x, y, radius, dx, dy, obstacles) {
  const blocked = (cx, cy) => {
    for (let i = 0; i < obstacles.length; i += 1) {
      if (circleHitsRect(cx, cy, radius, obstacles[i])) return true;
    }
    return false;
  };
  const tryMove = (fromX, fromY, stepX, stepY) => {
    let nextX = fromX + stepX;
    let nextY = fromY + stepY;
    if (blocked(nextX, fromY)) nextX = fromX;
    if (blocked(nextX, nextY)) nextY = fromY;
    return { x: nextX, y: nextY };
  };
  let moved = tryMove(x, y, dx, dy);
  if ((moved.x !== x || moved.y !== y) || (dx === 0 && dy === 0)) {
    return clampToFloor(moved.x, moved.y, radius);
  }
  // Stalled: slide along the obstacle by rotating the push.
  const rotations = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
  for (let i = 0; i < rotations.length; i += 1) {
    const cos = Math.cos(rotations[i]);
    const sin = Math.sin(rotations[i]);
    const rotated = tryMove(x, y, dx * cos - dy * sin, dx * sin + dy * cos);
    if (rotated.x !== x || rotated.y !== y) {
      moved = rotated;
      break;
    }
  }
  return clampToFloor(moved.x, moved.y, radius);
}

/** Keep a point inside the floor, a circle radius clear of the outer walls. */
function clampToFloor(x, y, radius) {
  return {
    x: Math.max(FLOOR.x + 14 + radius, Math.min(FLOOR.x + FLOOR.width - 14 - radius, x)),
    y: Math.max(FLOOR.y + 14 + radius, Math.min(FLOOR.y + FLOOR.height - 14 - radius, y)),
  };
}

/** The outer walls and the interior partitions that shape the three routes. */
export function buildWalls() {
  const walls = [
    // Outer shell.
    rect(0, 72, 1280, 14, 'wall'),
    rect(0, 786, 1280, 14, 'wall'),
    rect(0, 72, 14, 728, 'wall'),
    rect(1266, 72, 14, 728, 'wall'),
    // Vault row: three gold vault doors set into the top wall, each a solid block the
    // thief must stand before to grab its bars.
    rect(280, 86, 100, 54, 'vault'),
    rect(590, 86, 100, 54, 'vault'),
    rect(900, 86, 100, 54, 'vault'),
    // Manager's office, top-right: two walls and a door gap at the bottom.
    rect(1080, 86, 14, 160, 'wall'),
    rect(1080, 86, 186, 14, 'wall'),
    rect(1080, 232, 40, 14, 'wall'),
    rect(1180, 232, 86, 14, 'wall'),
    // Central partitions that split the grand hall into lanes.
    rect(430, 300, 16, 220, 'wall'),
    rect(850, 300, 16, 220, 'wall'),
    rect(500, 480, 280, 16, 'wall'),
  ];
  return walls;
}

/** Gaming tables and slot banks: cover that blocks movement and sight. */
export function buildTables() {
  return [
    rect(300, 300, 90, 60, 'table'),
    rect(700, 320, 110, 60, 'table'),
    rect(950, 480, 90, 60, 'table'),
    rect(250, 520, 90, 60, 'table'),
    rect(560, 620, 200, 40, 'table'),
    rect(1080, 620, 90, 60, 'table'),
  ];
}

/**
 * The 12 laser grids. Each is a beam between two emitters; crossing it trips the alarm.
 * Six guard the left service corridor, four guard the vault doors, one guards the office
 * door and one crosses the gap in the central partition.
 */
export function buildLasers() {
  const beams = [];
  const add = (x1, y1, x2, y2) => beams.push({ x1, y1, x2, y2, cooldown: 0, tripped: false });
  // Service corridor, left side: six horizontal beams across the lane.
  for (let i = 0; i < 6; i += 1) add(180, 200 + i * 80, 250, 200 + i * 80);
  // Vault approaches: vertical beams before vaults B and C.
  add(560, 140, 560, 220);
  add(720, 140, 720, 220);
  add(870, 140, 870, 220);
  add(1030, 140, 1030, 220);
  // Manager's office door.
  add(1120, 250, 1180, 250);
  // The gap in the central partition.
  add(620, 480, 660, 480);
  return beams;
}

/**
 * The 8 security cameras. Each sits on a wall, faces a base angle and sweeps back and forth.
 * `sweep` is how far either side of the base angle the lens travels.
 */
export function buildCameras() {
  return [
    { x: 340, y: 96, baseAngle: Math.PI / 2 + 0.45, sweep: 0.7, phase: 0, angle: Math.PI / 2, lockOn: 0, disabled: 0 },
    { x: 950, y: 96, baseAngle: Math.PI / 2 - 0.45, sweep: 0.7, phase: 1.4, angle: Math.PI / 2, lockOn: 0, disabled: 0 },
    { x: 24, y: 300, baseAngle: 0, sweep: 0.8, phase: 2.2, angle: 0, lockOn: 0, disabled: 0 },
    { x: 1256, y: 420, baseAngle: Math.PI, sweep: 0.8, phase: 0.6, angle: Math.PI, lockOn: 0, disabled: 0 },
    { x: 438, y: 306, baseAngle: 0, sweep: 0.7, phase: 3.1, angle: 0, lockOn: 0, disabled: 0 },
    { x: 1094, y: 150, baseAngle: 0, sweep: 0.7, phase: 1.9, angle: 0, lockOn: 0, disabled: 0 },
    { x: 320, y: 776, baseAngle: -Math.PI / 2, sweep: 0.9, phase: 2.8, angle: -Math.PI / 2, lockOn: 0, disabled: 0 },
    { x: 1100, y: 776, baseAngle: -Math.PI / 2, sweep: 0.9, phase: 0.2, angle: -Math.PI / 2, lockOn: 0, disabled: 0 },
  ];
}

/** The 5 guards and their patrol loops, each with a name the HUD can call out. */
export function buildGuards() {
  return [
    {
      name: 'Bruno', x: 300, y: 220, angle: 0, waypoints: [[300, 220], [640, 220], [980, 220]],
      waypointIndex: 1, suspicion: 0, chasing: false, wait: 0, speed: 0, loseSight: 0,
    },
    {
      name: 'Vera', x: 500, y: 380, angle: 0, waypoints: [[500, 380], [780, 380], [780, 560], [500, 560]],
      waypointIndex: 1, suspicion: 0, chasing: false, wait: 0, speed: 0, loseSight: 0,
    },
    {
      name: 'Otto', x: 215, y: 180, angle: Math.PI / 2, waypoints: [[215, 180], [215, 640]],
      waypointIndex: 1, suspicion: 0, chasing: false, wait: 0, speed: 0, loseSight: 0,
    },
    {
      name: 'Mina', x: 900, y: 400, angle: 0, waypoints: [[900, 400], [1150, 400], [1150, 650], [900, 650]],
      waypointIndex: 1, suspicion: 0, chasing: false, wait: 0, speed: 0, loseSight: 0,
    },
    {
      name: 'Sal', x: 300, y: 700, angle: 0, waypoints: [[300, 700], [1000, 700]],
      waypointIndex: 1, suspicion: 0, chasing: false, wait: 0, speed: 0, loseSight: 0,
    },
  ];
}

/** The loot: 6 gold bars (two per vault) and the Casino Ledger on the manager's desk. */
export function buildLoot() {
  const loot = [];
  const bar = (x, y) => loot.push({ kind: 'gold', x, y, value: 500, taken: false });
  bar(300, 158);
  bar(360, 158);
  bar(610, 158);
  bar(670, 158);
  bar(920, 158);
  bar(980, 158);
  loot.push({ kind: 'ledger', x: 1180, y: 150, value: 1500, taken: false });
  return loot;
}

/** The whole level in one object: walls, tables, lasers, cameras, guards, loot, doors. */
export function createLevel() {
  const walls = buildWalls();
  const tables = buildTables();
  const obstacles = walls.concat(tables);
  return {
    walls,
    tables,
    obstacles,
    lasers: buildLasers(),
    cameras: buildCameras(),
    guards: buildGuards(),
    loot: buildLoot(),
    spawn: { x: ENTRANCE.x + ENTRANCE.width / 2, y: ENTRANCE.y - 30 },
    exit: { x: EXIT.x + EXIT.width / 2, y: EXIT.y - 30 },
    entrance: ENTRANCE,
    exitRect: EXIT,
  };
}
