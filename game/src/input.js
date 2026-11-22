// input.js reads the keyboard and the mouse. WASD or arrows walk, Space or E grabs loot,
// 1/2/3 fire the tools, P or Escape pauses, Enter or Space confirms on the title and end
// screens. A mouse click on the floor sets a walk target; a click on a HUD tool button fires
// that tool. The game polls `takeActions()` once a frame, so a key press is never missed
// between frames and never fires twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_GRAB = 4;
export const ACTION_EMP = 8;
export const ACTION_SMOKE = 16;
export const ACTION_DISGUISE = 32;

/** Attach listeners to the canvas and return the live input state. */
export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let clickTarget = null;

  const keyMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  function onKeyDown(event) {
    const direction = keyMap[event.code];
    if (direction) {
      keys[direction] = true;
      clickTarget = null;
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM | ACTION_GRAB;
      event.preventDefault();
    } else if (event.code === 'KeyE') {
      actions |= ACTION_GRAB;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'Digit1') {
      actions |= ACTION_EMP;
    } else if (event.code === 'Digit2') {
      actions |= ACTION_SMOKE;
    } else if (event.code === 'Digit3') {
      actions |= ACTION_DISGUISE;
    }
  }

  function onKeyUp(event) {
    const direction = keyMap[event.code];
    if (direction) keys[direction] = false;
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    clickTarget = { x, y };
  }

  function onBlur() {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    keys,
    /** One-shot actions since the last call; clears after reading. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The latest click target, or null. The game clears it by writing null. */
    get clickTarget() {
      return clickTarget;
    },
    set clickTarget(value) {
      clickTarget = value;
    },
  };
}
