// THE GILDED VAULT — a casino-vault heist. config.js holds every number the rest of the
// game reads: the canvas size, the clock, the alarm, the crew, the tools and the loot.
// Change a number here and the whole heist retunes; no other file hard-codes a balance value.

/** Logical canvas size. The renderer scales this to the window; screenshots are 1280x800. */
export const VIEW = { width: 1280, height: 800 };

/** Height of the HUD bar across the top; the vault floor starts below it. */
export const HUD_HEIGHT = 72;

/** The vault floor rectangle, in canvas pixels. */
export const FLOOR = { x: 0, y: HUD_HEIGHT, width: 1280, height: 800 - HUD_HEIGHT };

/** Fixed simulation step, seconds. */
export const STEP = 1 / 60;

/** The heist clock: 180 seconds from the first move to the getaway door slamming shut. */
export const TIME_LIMIT = 180;

/** Alarm runs 0 to 100. At 100 the vault locks down and the heist is over. */
export const ALARM_MAX = 100;
/** Alarm drains this fast per second while nobody can see the thief. */
export const ALARM_DECAY = 4;
/** Alarm gained per second while a camera holds the thief in its cone. */
export const ALARM_CAMERA_RATE = 26;
/** Alarm gained per second while a guard holds the thief in its cone. */
export const ALARM_GUARD_RATE = 14;
/** Alarm gained the instant the thief crosses a laser beam. */
export const ALARM_LASER_HIT = 12;
/** Alarm gained when a guard catches the thief. */
export const ALARM_CAUGHT = 25;

/** The thief starts with 3 nerves. A catch costs one; at zero the crew walks away. */
export const NERVES_START = 3;

/** Player movement: base speed in pixels per second, and the thief's radius. */
export const PLAYER = { speed: 205, radius: 13, grabRange: 34 };

/** Guard numbers: patrol speed, chase speed, cone range and half-angle, suspicion time. */
export const GUARD = {
  patrolSpeed: 62,
  chaseSpeed: 168,
  coneRange: 185,
  coneHalfAngle: 0.62,
  /** Seconds of being watched before a guard is sure and gives chase. */
  suspicionTime: 0.9,
  /** How far a chasing guard gives up and walks back to patrol, in pixels. */
  giveUpRange: 260,
  radius: 14,
};

/** Camera numbers: sweep range, cone half-angle and sweep speed. */
export const CAMERA = {
  coneRange: 195,
  coneHalfAngle: 0.5,
  sweepSpeed: 0.55,
  /** Seconds a camera needs to hold the thief before the alarm starts climbing. */
  lockOnTime: 0.45,
};

/** Laser beams: how long one beam sleeps after it is tripped, in seconds. */
export const LASER = { cooldown: 2.5, width: 3 };

/** Tools, each with a price the crew pays from the take. */
export const TOOLS = {
  /** EMP: kills every camera for 10 s. Costs $400 of the take. */
  emp: { key: '1', cost: 400, duration: 10, startCount: Infinity },
  /** Smoke bomb: 3 charges. A cloud hides the thief for 6 s. */
  smoke: { key: '2', cost: 0, duration: 6, startCount: 3 },
  /** Disguise: 2 uses. Guards take the thief for staff for 8 s, but the thief walks slower. */
  disguise: { key: '3', cost: 300, duration: 8, startCount: 2 },
};

/** Loot values in dollars. */
export const LOOT = {
  goldBar: 500,
  ledger: 1500,
  /** Each gold bar carried slows the thief by this fraction, up to the cap below. */
  slowPerBar: 0.04,
  slowCap: 0.2,
  /** Time bonus per second left on the clock when the thief escapes. */
  timeBonusPerSecond: 10,
};

/** Best-score key in localStorage. */
export const BEST_KEY = 'gilded-vault-best';

/** The getaway door: the strip along the bottom-right wall the thief must reach with loot. */
export const EXIT = { x: 1120, y: 748, width: 130, height: 52 };

/** The service door the thief slips in through, bottom-left. */
export const ENTRANCE = { x: 30, y: 748, width: 130, height: 52 };

/** How close the thief must stand to a vault door or the ledger desk to grab it. */
export const GRAB = { vaultRange: 46, ledgerRange: 40 };

/** Smoke cloud radius in pixels; a thief inside it cannot be seen at all. */
export const SMOKE_RADIUS = 74;

/** Disguise walk speed multiplier while the thief is dressed as casino staff. */
export const DISGUISE_SPEED = 0.72;
