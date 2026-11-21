// render.js — everything the eye sees: the moonlit garden, the wardens' lantern
// cones, the dark that hides the courier, the HUD and the title, win and
// game-over screens. All drawing is plain canvas, no images.

import { COLOURS, GARDEN_Y, LEVEL_COLS, LEVEL_ROWS, TILE, TUNING, VIEW_HEIGHT, VIEW_WIDTH } from './config.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS, gradeNight } from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';
export const SCREEN_PAUSE = 'pause';

/** A stable pseudo-random shade per tile, so the lawn never looks flat. */
function tileShade(col, row) {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFloor(ctx, level) {
  for (let row = 0; row < LEVEL_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_COLS; col += 1) {
      const shade = tileShade(col, row);
      ctx.fillStyle = shade > 0.5 ? COLOURS.lawnLight : COLOURS.lawnDark;
      ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
      if (shade > 0.86) {
        ctx.fillStyle = 'rgba(120, 180, 110, 0.10)';
        ctx.fillRect(col * TILE + 8, row * TILE + 10, 5, 5);
        ctx.fillRect(col * TILE + 24, row * TILE + 26, 4, 4);
      }
    }
  }
  // Stone paths: the main walkways read at a glance.
  ctx.fillStyle = COLOURS.path;
  for (let row = 0; row < LEVEL_ROWS; row += 1) {
    for (let col = 0; col < LEVEL_COLS; col += 1) {
      if (level.wallSet.has(`${col},${row}`)) continue;
      if (col === 1 || row === 7 || row === 14) {
        ctx.fillRect(col * TILE + 2, row * TILE + 2, TILE - 4, TILE - 4);
      }
    }
  }
}

function drawHedges(ctx, level) {
  for (const wall of level.walls) {
    const x = wall.col * TILE;
    const y = wall.row * TILE;
    // A hedge fills its whole tile, so a row of them reads as one wall.
    ctx.fillStyle = COLOURS.hedge;
    roundRect(ctx, x, y, TILE, TILE, 4);
    ctx.fill();
    ctx.fillStyle = COLOURS.hedgeTop;
    roundRect(ctx, x + 4, y + 4, TILE - 8, TILE - 15, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(90, 200, 110, 0.25)';
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 3, 0, Math.PI * 2);
    ctx.arc(x + 26, y + 18, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBush(ctx, bush, time) {
  const sway = Math.sin(time * 1.3 + bush.col * 2.1 + bush.row) * 1.5;
  ctx.fillStyle = COLOURS.bush;
  ctx.beginPath();
  ctx.arc(bush.x + sway, bush.y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOURS.bushLeaf;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + bush.col;
    ctx.beginPath();
    ctx.arc(bush.x + Math.cos(a) * 11 + sway, bush.y + Math.sin(a) * 9, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(180, 255, 190, 0.25)';
  ctx.beginPath();
  ctx.arc(bush.x - 6 + sway, bush.y - 7, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawFountain(ctx, fountain, time) {
  ctx.fillStyle = '#274b63';
  ctx.beginPath();
  ctx.ellipse(fountain.x, fountain.y, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOURS.water;
  ctx.beginPath();
  ctx.ellipse(fountain.x, fountain.y, 15, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLOURS.waterGlint;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(fountain.x, fountain.y, 9 + Math.sin(time * 2) * 2, 6, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawKey(ctx, key, time) {
  if (key.taken) return;
  const pulse = 0.75 + Math.sin(time * 3 + key.col) * 0.25;
  const glow = ctx.createRadialGradient(key.x, key.y, 2, key.x, key.y, 30);
  glow.addColorStop(0, `rgba(255, 215, 106, ${0.5 * pulse})`);
  glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(key.x, key.y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOURS.keyGold;
  ctx.beginPath();
  ctx.arc(key.x, key.y - 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(key.x - 1.5, key.y + 3, 3, 10);
  ctx.fillRect(key.x - 1.5, key.y + 10, 7, 2.5);
  ctx.fillRect(key.x - 1.5, key.y + 14, 5, 2.5);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(key.x - 2, key.y - 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawGate(ctx, gate, open, time) {
  const x = gate.x;
  const y = gate.y;
  ctx.fillStyle = '#4a3823';
  ctx.fillRect(x - 20, y - 18, 6, 36);
  ctx.fillRect(x + 14, y - 18, 6, 36);
  ctx.fillStyle = COLOURS.gate;
  ctx.fillRect(x - 22, y - 20, 44, 6);
  if (open) {
    const glow = ctx.createRadialGradient(x, y + 4, 2, x, y + 4, 34);
    glow.addColorStop(0, 'rgba(255, 230, 150, 0.85)');
    glow.addColorStop(1, 'rgba(255, 230, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y + 4, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', x, y - 28 + Math.sin(time * 2) * 2);
  } else {
    ctx.strokeStyle = '#8a744e';
    ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * 7, y - 16);
      ctx.lineTo(x + i * 7, y + 16);
      ctx.stroke();
    }
    ctx.fillStyle = '#d8c49a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOCKED', x, y - 28);
  }
}

function drawVisionCone(ctx, guard) {
  const range = TUNING.visionRange;
  const colour = guard.state === GUARD_ALERT
    ? COLOURS.coneAlert
    : guard.state === GUARD_SUSPICIOUS ? COLOURS.coneSuspicious : COLOURS.coneCalm;
  const grad = ctx.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, range);
  grad.addColorStop(0, colour);
  grad.addColorStop(0.65, colour.replace(/[\d.]+\)$/, '0.18)'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.arc(guard.x, guard.y, range, guard.angle - TUNING.visionHalfAngle, guard.angle + TUNING.visionHalfAngle);
  ctx.closePath();
  ctx.fill();
  // The cone's rim, so its edge reads even on bright lawn.
  ctx.strokeStyle = colour.replace(/[\d.]+\)$/, '0.55)');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.arc(guard.x, guard.y, range, guard.angle - TUNING.visionHalfAngle, guard.angle + TUNING.visionHalfAngle);
  ctx.closePath();
  ctx.stroke();
}

function drawGuard(ctx, guard, time) {
  drawVisionCone(ctx, guard);
  const bob = Math.sin(guard.stepPhase) * 1.5;
  // Lantern light pool.
  const glow = ctx.createRadialGradient(guard.x, guard.y, 4, guard.x, guard.y, 46);
  glow.addColorStop(0, 'rgba(255, 179, 71, 0.35)');
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 46, 0, Math.PI * 2);
  ctx.fill();
  // Body: a warden in a rust-red coat, facing where he looks.
  ctx.save();
  ctx.translate(guard.x, guard.y + bob * 0.3);
  ctx.rotate(guard.angle);
  ctx.fillStyle = COLOURS.guardCoat;
  ctx.beginPath();
  ctx.arc(0, 0, TUNING.guardRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8d9b0';
  ctx.beginPath();
  ctx.arc(7, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOURS.guardLantern;
  ctx.beginPath();
  ctx.arc(14, 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Suspicion: "?" while wondering, "!" while chasing, with a filling ring.
  if (guard.state === GUARD_SUSPICIOUS) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', guard.x, guard.y - 24);
  }
  if (guard.state === GUARD_ALERT) {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', guard.x, guard.y - 26);
  }
  if (guard.suspicion > 0.02 && guard.state !== GUARD_ALERT) {
    ctx.strokeStyle = 'rgba(255, 215, 106, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 20, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer(ctx, player, world, time) {
  const p = player;
  const bob = p.moving ? Math.sin(p.stepPhase) * 1.5 : 0;
  // A soft pool of moonlight follows the courier.
  const glow = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, 60);
  glow.addColorStop(0, 'rgba(160, 190, 255, 0.20)');
  glow.addColorStop(1, 'rgba(160, 190, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  ctx.rotate(p.angle);
  ctx.globalAlpha = p.hidden ? 0.55 : 1;
  // Cloak.
  ctx.fillStyle = COLOURS.playerCloak;
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(-9, -10);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-9, 10);
  ctx.closePath();
  ctx.fill();
  // Hood.
  ctx.fillStyle = COLOURS.playerHood;
  ctx.beginPath();
  ctx.arc(2, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20263a';
  ctx.beginPath();
  ctx.arc(6, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Running makes noise: a ring shows how far the sound carries.
  if (p.running && p.moving) {
    const pulse = (time * 1.6) % 1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * (1 - pulse)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12 + pulse * 34, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Being seen: an eye over the courier that fills with the alarm.
  if (world.alarm > 0.05) {
    ctx.fillStyle = world.alarm > 0.9 ? '#ff5a4a' : '#ffd76a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SEEN', p.x, p.y - 26);
  }
}

function drawPebbles(ctx, world) {
  for (const pebble of world.pebbles) {
    const fade = 1 - pebble.age / 6;
    ctx.strokeStyle = `rgba(255, 220, 130, ${0.6 * fade})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pebble.x, pebble.y, 6 + pebble.age * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#d8d2c0';
    ctx.beginPath();
    ctx.arc(pebble.x, pebble.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClickTarget(ctx, target, time) {
  if (!target) return;
  const pulse = 0.6 + Math.sin(time * 5) * 0.4;
  ctx.strokeStyle = `rgba(160, 190, 255, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(target.x - 12, target.y);
  ctx.lineTo(target.x - 5, target.y);
  ctx.moveTo(target.x + 5, target.y);
  ctx.lineTo(target.x + 12, target.y);
  ctx.moveTo(target.x, target.y - 12);
  ctx.lineTo(target.x, target.y - 5);
  ctx.moveTo(target.x, target.y + 5);
  ctx.lineTo(target.x, target.y + 12);
  ctx.stroke();
}

/** The night itself: darkness everywhere except the moonlit pools. */
function drawDarkness(ctx, world) {
  const p = world.player;
  const grad = ctx.createRadialGradient(p.x, p.y, 60, p.x, p.y, 330);
  grad.addColorStop(0, 'rgba(6, 8, 18, 0)');
  grad.addColorStop(0.65, 'rgba(6, 8, 18, 0.12)');
  grad.addColorStop(1, 'rgba(6, 8, 18, 0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_WIDTH, 640);
  // A sliver of moon in the corner, for mood.
  ctx.fillStyle = 'rgba(230, 238, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(VIEW_WIDTH - 52, 44, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(11, 16, 32, 0.55)';
  ctx.beginPath();
  ctx.arc(VIEW_WIDTH - 44, 38, 18, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(ctx, world, ui) {
  const gateOpen = world.keysCollected >= TUNING.keysNeeded;
  // Top bar: the night's status. It sits above the garden, never over it.
  ctx.fillStyle = 'rgba(8, 10, 22, 0.85)';
  roundRect(ctx, 10, 6, VIEW_WIDTH - 20, 34, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  // Lantern keys.
  for (let i = 0; i < TUNING.keysNeeded; i += 1) {
    const x = 34 + i * 30;
    const y = 23;
    ctx.fillStyle = i < world.keysCollected ? COLOURS.keyGold : 'rgba(255, 215, 106, 0.25)';
    ctx.beginPath();
    ctx.arc(x, y - 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 1.5, y + 3, 3, 8);
  }
  ctx.fillStyle = '#e8e4d4';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText(`${world.keysCollected} / ${TUNING.keysNeeded} keys`, 128, 23);
  // Nerves.
  ctx.fillText('Nerves', 250, 23);
  for (let i = 0; i < TUNING.nerves; i += 1) {
    const x = 306 + i * 22;
    ctx.fillStyle = i < world.nerves ? '#ff7a6a' : 'rgba(255, 122, 106, 0.22)';
    ctx.beginPath();
    ctx.arc(x, 19, 6, 0, Math.PI * 2);
    ctx.arc(x + 8, 19, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 5, 21);
    ctx.lineTo(x + 13, 21);
    ctx.lineTo(x + 4, 33);
    ctx.closePath();
    ctx.fill();
  }
  // Pebbles.
  ctx.fillStyle = '#e8e4d4';
  ctx.fillText(`Pebbles ${world.pebblesLeft}  (Q)`, 400, 23);
  // Alarm meter.
  ctx.fillStyle = '#e8e4d4';
  ctx.font = '600 12px system-ui, sans-serif';
  const alarmLabel = world.alarm > 0.85 ? 'ALARM!' : world.alarm > 0.4 ? 'Suspicion' : 'Unseen';
  ctx.fillText(alarmLabel, 540, 23);
  const meterX = 612;
  const meterW = 190;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, meterX, 15, meterW, 14, 7);
  ctx.fill();
  const alarmColour = world.alarm > 0.85 ? '#ff5a4a' : world.alarm > 0.4 ? '#ff9a3c' : '#ffd76a';
  ctx.fillStyle = alarmColour;
  if (world.alarm > 0.01) {
    roundRect(ctx, meterX, 15, meterW * Math.min(1, world.alarm), 14, 7);
    ctx.fill();
  }
  // Timer.
  const minutes = Math.floor(world.time / 60);
  const seconds = Math.floor(world.time % 60);
  ctx.fillStyle = '#e8e4d4';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${minutes}:${String(seconds).padStart(2, '0')}`, VIEW_WIDTH - 30, 23);
  ctx.textAlign = 'left';
  // Bottom bar: the objective and the controls, below the garden.
  ctx.fillStyle = 'rgba(8, 10, 22, 0.85)';
  roundRect(ctx, 10, VIEW_HEIGHT - 26, VIEW_WIDTH - 20, 20, 8);
  ctx.fill();
  ctx.fillStyle = '#cfd6e8';
  ctx.font = '13px system-ui, sans-serif';
  const objective = gateOpen
    ? 'All keys pocketed — reach the garden gate at the south wall.'
    : 'Slip past the wardens, pocket the three silver lantern keys, then leave by the south gate.';
  ctx.fillText(objective, 22, VIEW_HEIGHT - 16);
  ctx.fillStyle = '#8b93a8';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move · Shift run · C sneak · Q pebble · M mute · P pause', VIEW_WIDTH - 22, VIEW_HEIGHT - 16);
  ctx.textAlign = 'left';
  // Toast message, just under the top bar.
  if (world.message && world.time - world.messageAt < 4) {
    ctx.fillStyle = 'rgba(8, 10, 22, 0.8)';
    const w = ctx.measureText(world.message).width + 32;
    roundRect(ctx, (VIEW_WIDTH - w) / 2, 48, w, 32, 9);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, VIEW_WIDTH / 2, 65);
    ctx.textAlign = 'left';
  }
  if (ui.muted) {
    ctx.fillStyle = '#8b93a8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('muted (M)', VIEW_WIDTH - 30, 96);
    ctx.textAlign = 'left';
  }
}

function drawTitle(ctx, world, ui) {
  drawWorld(ctx, world, ui, false);
  ctx.fillStyle = 'rgba(5, 7, 16, 0.62)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText('WREN', VIEW_WIDTH / 2, 192);
  ctx.fillStyle = '#dfe6f5';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText('Shadow Courier', VIEW_WIDTH / 2, 230);
  ctx.fillStyle = '#c6cede';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('One courier. One sleeping manor. Three silver lantern keys.', VIEW_WIDTH / 2, 276);
  ctx.fillText('Slip past the wardens, pocket the keys, and leave by the south gate — unseen.', VIEW_WIDTH / 2, 302);
  ctx.fillStyle = '#e8e4d4';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD / arrows — move      Shift — run (loud)      C — sneak (quiet)', VIEW_WIDTH / 2, 364);
  ctx.fillText('Click — walk there      Q / right-click — toss a pebble      M — mute      P — pause', VIEW_WIDTH / 2, 390);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Bushes hide you. Running is heard. A warden who sees you fills the alarm —', VIEW_WIDTH / 2, 436);
  ctx.fillText('break his line of sight and the garden calms down again.', VIEW_WIDTH / 2, 458);
  const pulse = 0.65 + Math.sin(ui.time * 3) * 0.35;
  ctx.fillStyle = `rgba(255, 233, 168, ${pulse})`;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Click or press Enter to begin the night', VIEW_WIDTH / 2, 524);
  ctx.fillStyle = '#8b93a8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('A stealth game in one moonlit garden — original art, sound and music, made for this night.', VIEW_WIDTH / 2, 580);
  ctx.textAlign = 'left';
}

function drawWin(ctx, world) {
  const grade = gradeNight(world);
  ctx.fillStyle = 'rgba(5, 7, 16, 0.78)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 46px Georgia, serif';
  ctx.fillText('GONE LIKE MOONLIGHT', VIEW_WIDTH / 2, 214);
  ctx.fillStyle = '#dfe6f5';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('You slipped the gate with all three keys.', VIEW_WIDTH / 2, 256);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText(grade.title, VIEW_WIDTH / 2, 334);
  ctx.fillStyle = '#c6cede';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(grade.line, VIEW_WIDTH / 2, 368);
  const minutes = Math.floor(world.time / 60);
  const seconds = Math.floor(world.time % 60);
  ctx.fillStyle = '#e8e4d4';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`Night finished in ${minutes}:${String(seconds).padStart(2, '0')}  ·  caught ${world.timesCaught} ${world.timesCaught === 1 ? 'time' : 'times'}  ·  alarms raised ${world.timesAlerted}`, VIEW_WIDTH / 2, 416);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press R to play the night again', VIEW_WIDTH / 2, 472);
  ctx.textAlign = 'left';
}

function drawGameOver(ctx, world) {
  ctx.fillStyle = 'rgba(16, 5, 8, 0.8)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff7a6a';
  ctx.font = 'bold 46px Georgia, serif';
  ctx.fillText('CAUGHT IN THE LANTERN LIGHT', VIEW_WIDTH / 2, 224);
  ctx.fillStyle = '#dfe6f5';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('The wardens took you by the arm and the night ended.', VIEW_WIDTH / 2, 268);
  ctx.fillStyle = '#e8e4d4';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`You pocketed ${world.keysCollected} of ${TUNING.keysNeeded} keys before the garden closed in.`, VIEW_WIDTH / 2, 324);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press R to try the night again', VIEW_WIDTH / 2, 380);
  ctx.textAlign = 'left';
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(5, 7, 16, 0.6)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#dfe6f5';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('PAUSED', VIEW_WIDTH / 2, 324);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press P or Esc to return to the garden', VIEW_WIDTH / 2, 364);
  ctx.textAlign = 'left';
}

/** The garden itself, without HUD or screens — shared by play and the title. */
export function drawWorld(ctx, world, ui, withDarkness = true) {
  const { level } = world;
  ctx.save();
  ctx.translate(0, GARDEN_Y);
  ctx.fillStyle = COLOURS.night;
  ctx.fillRect(0, 0, VIEW_WIDTH, 640);
  drawFloor(ctx, level);
  for (const bush of level.bushes) drawBush(ctx, bush, ui.time);
  for (const fountain of level.fountains) drawFountain(ctx, fountain, ui.time);
  for (const key of level.keys) drawKey(ctx, key, ui.time);
  drawGate(ctx, level.gate, world.keysCollected >= TUNING.keysNeeded, ui.time);
  drawHedges(ctx, level);
  for (const guard of world.guards) drawGuard(ctx, guard, ui.time);
  drawPebbles(ctx, world);
  drawPlayer(ctx, world.player, world, ui.time);
  // A courier crouched in a bush is covered by its leaves.
  if (world.player.hidden) {
    for (const bush of level.bushes) {
      if (bush.col === Math.floor(world.player.x / TILE) && bush.row === Math.floor(world.player.y / TILE)) {
        drawBush(ctx, bush, ui.time);
      }
    }
  }
  drawClickTarget(ctx, world.player.moveTarget, ui.time);
  if (withDarkness) drawDarkness(ctx, world);
  ctx.restore();
}

/** One frame of whatever screen the game is on. */
export function drawScreen(ctx, world, screen, ui) {
  ctx.save();
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  if (screen === SCREEN_TITLE) {
    drawTitle(ctx, world, ui);
  } else if (screen === SCREEN_WIN) {
    drawWorld(ctx, world, ui, false);
    drawWin(ctx, world);
  } else if (screen === SCREEN_OVER) {
    drawWorld(ctx, world, ui, false);
    drawGameOver(ctx, world);
  } else {
    drawWorld(ctx, world, ui, true);
    drawHud(ctx, world, ui);
    if (screen === SCREEN_PAUSE) drawPause(ctx);
  }
  ctx.restore();
}
