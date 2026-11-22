// loot.js is the score. Gold bars sit in the three vaults, the Casino Ledger sits on the
// manager's desk, and the thief grabs them by standing close and pressing Space (or E, or
// clicking). Gold is heavy: every bar carried slows the thief a little, so a full haul is a
// slower, riskier walk to the getaway door. The Ledger is light and worth three bars —
// the twist of this heist is that the gold is the decoy and the Ledger is the real score.

import { GRAB, LOOT, PLAYER } from './config.js';

/** Total value of the loot the thief is carrying right now. */
export function carriedValue(loot) {
  let total = 0;
  for (let i = 0; i < loot.length; i += 1) if (loot[i].taken) total += loot[i].value;
  return total;
}

/** How many gold bars the thief carries (drives the slow-down). */
export function goldCarried(loot) {
  let count = 0;
  for (let i = 0; i < loot.length; i += 1) if (loot[i].taken && loot[i].kind === 'gold') count += 1;
  return count;
}

/** True when the thief carries the Casino Ledger. */
export function hasLedger(loot) {
  for (let i = 0; i < loot.length; i += 1) if (loot[i].taken && loot[i].kind === 'ledger') return true;
  return false;
}

/** Speed multiplier from the weight of the gold: each bar costs 4%, capped at 20%. */
export function carrySpeedMultiplier(loot) {
  return 1 - Math.min(LOOT.slowCap, goldCarried(loot) * LOOT.slowPerBar);
}

/**
 * Try to grab loot near the thief. Returns the item grabbed, or null. The nearest untaken
 * item within grab range goes first.
 */
export function tryGrabLoot(loot, player) {
  let best = null;
  let bestDistance = Infinity;
  for (let i = 0; i < loot.length; i += 1) {
    const item = loot[i];
    if (item.taken) continue;
    const range = item.kind === 'ledger' ? GRAB.ledgerRange : GRAB.vaultRange;
    const distance = Math.hypot(item.x - player.x, item.y - player.y);
    if (distance <= range && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  if (best) best.taken = true;
  return best;
}

/** The nearest untaken loot and its distance, for the "press SPACE to grab" prompt. */
export function nearestLoot(loot, player) {
  let best = null;
  let bestDistance = Infinity;
  for (let i = 0; i < loot.length; i += 1) {
    const item = loot[i];
    if (item.taken) continue;
    const range = item.kind === 'ledger' ? GRAB.ledgerRange : GRAB.vaultRange;
    const distance = Math.hypot(item.x - player.x, item.y - player.y);
    if (distance <= range && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best === null ? null : { item: best, distance: bestDistance };
}

/** How many pieces of loot are still on the floor (7 at the start: 6 bars + the Ledger). */
export function lootRemaining(loot) {
  let count = 0;
  for (let i = 0; i < loot.length; i += 1) if (!loot[i].taken) count += 1;
  return count;
}

/** Total value of everything in the vault, taken or not — the heist's full $4,500. */
export function totalLootValue(loot) {
  let total = 0;
  for (let i = 0; i < loot.length; i += 1) total += loot[i].value;
  return total;
}
