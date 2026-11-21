// main.js — the night begins here: boot the canvas, run the loop, switch
// between title, play, pause, win and game-over, and play each event's sound.
// A ?shot=start|play|alert|win|over query stages a screenshot scene instead.

import { createWorld, stepWorld, throwPebble } from './entities.js';
import { createInput } from './input.js';
import { AudioEngine } from './audio.js';
import { drawScreen, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { worldForShot } from './shots.js';
import { GARDEN_Y, VIEW_HEIGHT, VIEW_WIDTH } from './config.js';

const STEP = 1 / 60;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;

const audio = new AudioEngine();
const input = createInput(canvas);

// Mouse clicks land on the canvas in page pixels; translate them to garden
// pixels (the garden starts GARDEN_Y below the canvas top, under the HUD).
input.toWorld = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT - GARDEN_Y,
  };
};

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
let world;
let screen;
if (shotName) {
  const staged = worldForShot(shotName, Number(params.get('seed') || 1));
  world = staged.world;
  screen = staged.screen;
} else {
  world = createWorld(1);
  screen = SCREEN_TITLE;
}

const oneShot = { enter: false, pause: false, restart: false, mute: false, pebbleKey: false };
let lastTime = performance.now();
let accumulator = 0;
let uiTime = 0;

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function startPlaying() {
  audio.ensure();
  screen = SCREEN_PLAY;
  announce('The night begins. Find the three silver lantern keys.');
}

function restartNight() {
  world = createWorld(1);
  screen = SCREEN_TITLE;
  announce('A new night. Press Enter to begin.');
}

function playEventSounds() {
  for (const event of world.events) {
    if (event.type === 'step') audio.playStep(false);
    else if (event.type === 'step-loud') audio.playStep(true);
    else if (event.type === 'key') audio.playPickup();
    else if (event.type === 'suspicious') audio.playSuspicious();
    else if (event.type === 'spotted') audio.playSpotted();
    else if (event.type === 'pebble') audio.playPebble();
    else if (event.type === 'caught') audio.playCaught();
    else if (event.type === 'win') audio.playWin();
  }
  if (world.lost && screen === SCREEN_PLAY) audio.playLose();
}

window.addEventListener('keydown', (event) => {
  audio.ensure();
  if (event.code === 'Enter' && screen === SCREEN_TITLE) oneShot.enter = true;
  if ((event.code === 'KeyP' || event.code === 'Escape') && (screen === SCREEN_PLAY || screen === SCREEN_PAUSE)) {
    oneShot.pause = true;
  }
  if (event.code === 'KeyR' && (screen === SCREEN_WIN || screen === SCREEN_OVER)) oneShot.restart = true;
  if (event.code === 'KeyM') oneShot.mute = true;
  if (event.code === 'KeyQ' && screen === SCREEN_PLAY) oneShot.pebbleKey = true;
});
canvas.addEventListener('mousedown', () => audio.ensure());

function handleOneShots() {
  if (oneShot.mute) {
    audio.setMuted(!audio.muted);
    oneShot.mute = false;
  }
  if (screen === SCREEN_TITLE && (oneShot.enter || input.clickTarget)) {
    input.clickTarget = null;
    startPlaying();
    return;
  }
  if (screen === SCREEN_WIN || screen === SCREEN_OVER) {
    if (oneShot.restart || input.clickTarget) {
      input.clickTarget = null;
      restartNight();
    }
    return;
  }
  if (oneShot.pause) {
    screen = screen === SCREEN_PAUSE ? SCREEN_PLAY : SCREEN_PAUSE;
    oneShot.pause = false;
  }
  if (screen === SCREEN_PLAY && oneShot.pebbleKey) {
    const rect = canvas.getBoundingClientRect();
    const target = input.toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (throwPebble(world, target.x, target.y)) audio.playPebble();
    oneShot.pebbleKey = false;
  }
  if (screen === SCREEN_PLAY && input.pebbleTarget) {
    if (throwPebble(world, input.pebbleTarget.x, input.pebbleTarget.y)) audio.playPebble();
    input.pebbleTarget = null;
  }
  if (screen === SCREEN_PLAY && input.clickTarget) {
    // Clicks on the HUD bars are not garden: ignore them.
    const target = input.clickTarget;
    if (target.x >= 0 && target.x <= VIEW_WIDTH && target.y >= 0 && target.y <= 640) {
      world.player.moveTarget = target;
    }
    input.clickTarget = null;
  }
  oneShot.enter = false;
  oneShot.restart = false;
}

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  uiTime += elapsed;
  handleOneShots();
  if (screen === SCREEN_PLAY && !shotName) {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepWorld(world, input, STEP);
      accumulator -= STEP;
    }
    playEventSounds();
    if (world.won) {
      screen = SCREEN_WIN;
      announce('You slipped the gate with all three keys.');
    } else if (world.lost) {
      screen = SCREEN_OVER;
      announce('Caught in the lantern light. The night is over.');
    }
  }
  drawScreen(ctx, world, screen, { time: uiTime, muted: audio.muted });
}

// A hook for play-testing: the page's state, readable from the console.
window.__game = {
  get world() { return world; },
  get screen() { return screen; },
  start: startPlaying,
  restart: restartNight,
  input,
};

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame(frame);

/** Fit the 960x640 garden into the window without stretching it. */
function resizeCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_WIDTH, window.innerHeight / VIEW_HEIGHT);
  canvas.style.width = `${Math.floor(VIEW_WIDTH * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_HEIGHT * scale)}px`;
}
