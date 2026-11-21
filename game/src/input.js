// input.js — keyboard and mouse, one small state object the world reads each
// step. WASD or arrows to walk, Shift to run, C or Ctrl to sneak, Q or a
// right-click to toss a pebble, left-click to walk to a spot, M to mute.

export function createInput(canvas) {
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    sneak: false,
    moveTarget: null, // { x, y } in world pixels, or null
    clickTarget: null, // consumed by the game loop: a left-click destination
    pebbleTarget: null, // consumed by the game loop: a pebble destination
    anyKey: false,
    toWorld: (clientX, clientY) => ({ x: clientX, y: clientY }),
  };

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    KeyC: 'sneak', ControlLeft: 'sneak', ControlRight: 'sneak',
  };

  window.addEventListener('keydown', (event) => {
    const field = KEYMAP[event.code];
    if (field) {
      input[field] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    }
    input.anyKey = true;
  });
  window.addEventListener('keyup', (event) => {
    const field = KEYMAP[event.code];
    if (field) input[field] = false;
  });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = input.run = input.sneak = false;
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('mousedown', (event) => {
    const point = input.toWorld(event.clientX, event.clientY);
    if (event.button === 2) input.pebbleTarget = point;
    else if (event.button === 0) input.clickTarget = point;
    input.anyKey = true;
  });

  return input;
}

/** Read the keys that only fire once per press; the game loop calls this each frame. */
export function pollOneShotKeys(pressed) {
  const out = { ...pressed };
  for (const key of Object.keys(pressed)) pressed[key] = false;
  return out;
}
