[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559) [![rank](https://make.fun/badge/best-heist-game-20261122-0559/yannyonn94/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559) [![reward](https://make.fun/badge/best-heist-game-20261122-0559/yannyonn94/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

# The Gilded Vault — A Casino Heist

Marlowe slips into the Aurum Grand casino at midnight. **5 guards, 8 cameras, 12 laser grids, 3 vaults, 180 seconds.** Six gold bars wait behind the vault doors — but the gold is the decoy. The real score is the **Casino Ledger** in the manager's office, worth $1,500. Grab what you can, mind the alarm, and reach the getaway van before the clock runs out.

## Play it

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and play in desktop Chrome. No network requests, no build step — plain vanilla canvas JavaScript with WebAudio synth sounds.

- **Move:** WASD / arrow keys, or click the floor to walk there
- **Grab loot:** Space or E near gold bars and the Ledger
- **Tools (each costs something):**
  - `1` — **EMP** ($400 of the take): kills all 8 cameras for 10 seconds
  - `2` — **Smoke bomb** (3 charges): a cloud hides you for 6 seconds
  - `3` — **Disguise** ($300 a use, 2 uses): guards take you for staff for 8 seconds, but you walk slower
- **Pause:** P or Escape

## The heist

- **Three routes across the room:** the grand hall (guarded), the laser-guarded service corridor down the left, and the office wing (cameras).
- **Fair catches:** guards and cameras build suspicion before they act — a suspicion ring fills above a guard, cameras lock on first, and the alarm climbs while you are seen and drains while you hide. A catch costs a nerve and sends you back to the service door; three catches end the night.
- **The alarm:** 0–100. Cameras and guards feed it while they watch you, lasers add +12 a trip, a catch adds +25. At 100 the vault locks down.
- **Heavy gold:** every bar you carry slows you 4% (up to 20%), so a full haul is a slower, riskier walk to the van.
- **The getaway:** reach the GETAWAY VAN door carrying loot to win. Score = loot − tool spend + $10 per second left on the clock. Full haul: $4,500.
- **Lose conditions:** caught 3 times, alarm hits 100 (lockdown), or the 180-second clock runs out. Win or lose, press Space to run it back — the guards and cameras jitter a little every visit.

## Files

| File | Job |
| --- | --- |
| `game/src/config.js` | Every balance number: clock, alarm, guards, cameras, tools, loot |
| `game/src/level.js` | The vault floor: walls, tables, 12 lasers, 8 cameras, 5 guards, loot |
| `game/src/guards.js` | Patrols, vision cones, suspicion, chase and catch |
| `game/src/cameras.js` | Camera sweep, lock-on, EMP blackout |
| `game/src/loot.js` | Gold bars, the Ledger, carry weight, grab range |
| `game/src/alarm.js` | Alarm meter, nerves, 180-second clock, win/lose |
| `game/src/player.js` | Marlowe: movement, click-to-walk, the three tools |
| `game/src/audio.js` | WebAudio synth: pickup, laser, EMP, alarm heartbeat, fanfare |
| `game/src/input.js` | Keyboard + mouse |
| `game/src/render.js` | Canvas painting: floor, cones, guards, loot, HUD, screens |
| `game/src/shots.js` | Deterministic staged scenes (`?shot=cover|patrol|tools|escape`) |
| `game/src/main.js` | Boot, fixed-step loop, screens, the shared step function |
| `game/src/random.js` | Seeded RNG for reproducible shots |

## Screenshots

Four real renders of the game's own code (`?shot=` scenes, seed 7):

1. `1-cover.jpg` — mid-heist at vault B: cones sweeping, cameras watching, alarm climbing
2. `2-patrol.jpg` — guards on patrol, Marlowe holding behind a table
3. `3-tools.jpg` — EMP dark + smoke cloud at the manager's office, Ledger in hand
4. `4-escape.jpg` — the getaway: loot in hand, a guard in pursuit, van door ahead

## License

MIT — see `LICENSE`.
