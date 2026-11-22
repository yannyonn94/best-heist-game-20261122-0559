// audio.js synthesises every sound with WebAudio — no audio files, no network. A soft
// pickup chime, a laser buzz, an EMP zap, a smoke puff, a guard's suspicious "huh", the
// caught sting, the alarm's heartbeat while the meter runs hot, and a little getaway fanfare.
// Sound starts only after the first key or click, as browsers require.

/** Create the sound engine. Call `unlock()` from the first user gesture. */
export function createAudio() {
  const engine = {
    context: null,
    master: null,
    alarmTimer: null,
    enabled: true,
  };

  /** Open the AudioContext (must run inside a user gesture). */
  function unlock() {
    if (engine.context) {
      if (engine.context.state === 'suspended') engine.context.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      engine.context = new AudioContext();
      engine.master = engine.context.createGain();
      engine.master.gain.value = 0.22;
      engine.master.connect(engine.context.destination);
    } catch {
      engine.context = null;
    }
  }

  /** One oscillator blip: frequency, seconds, shape, and a volume envelope. */
  function blip(frequency, duration, type, volume, slideTo) {
    if (!engine.context || !engine.master) return;
    const now = engine.context.currentTime;
    const oscillator = engine.context.createOscillator();
    const gain = engine.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(engine.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }

  /** A short two-note chime when the thief pockets gold or the Ledger. */
  function pickup(ledger) {
    blip(660, 0.12, 'sine', 0.5);
    setTimeout(() => blip(ledger ? 990 : 880, 0.18, 'sine', 0.5), 90);
  }

  /** The laser's angry buzz when a beam is tripped. */
  function laser() {
    blip(180, 0.22, 'sawtooth', 0.35, 90);
  }

  /** The EMP's electric zap. */
  function emp() {
    blip(1400, 0.3, 'square', 0.22, 120);
  }

  /** The smoke bomb's soft puff. */
  function smoke() {
    blip(320, 0.35, 'sine', 0.3, 90);
  }

  /** The disguise's smooth swish. */
  function disguise() {
    blip(520, 0.25, 'triangle', 0.3, 780);
  }

  /** A guard's suspicious "huh" — a short rising note when a chase starts. */
  function spotted() {
    blip(220, 0.16, 'square', 0.3, 330);
    setTimeout(() => blip(330, 0.2, 'square', 0.3, 440), 120);
  }

  /** The caught sting: a falling dissonant pair. */
  function caught() {
    blip(392, 0.3, 'sawtooth', 0.4, 196);
    setTimeout(() => blip(311, 0.4, 'sawtooth', 0.4, 155), 140);
  }

  /** The getaway fanfare: four rising notes when the thief escapes. */
  function win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, index) => {
      setTimeout(() => blip(note, 0.28, 'triangle', 0.45), index * 130);
    });
  }

  /** The flat game-over drone. */
  function lose() {
    blip(220, 0.7, 'sawtooth', 0.3, 110);
  }

  /** Start the alarm heartbeat while the meter runs hot; stop it when it cools. */
  function setAlarmHot(hot) {
    if (!engine.context) return;
    if (hot && !engine.alarmTimer) {
      engine.alarmTimer = setInterval(() => blip(880, 0.09, 'square', 0.16), 520);
    } else if (!hot && engine.alarmTimer) {
      clearInterval(engine.alarmTimer);
      engine.alarmTimer = null;
    }
  }

  /** A quiet tick for the HUD buttons, so clicks feel answered. */
  function click() {
    blip(700, 0.06, 'sine', 0.25);
  }

  return { unlock, pickup, laser, emp, smoke, disguise, spotted, caught, win, lose, setAlarmHot, click, engine };
}
