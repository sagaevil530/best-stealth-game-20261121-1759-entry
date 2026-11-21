// level.js — the garden as a grid: parsing the map, asking what blocks movement
// or sight, and finding a route across it. Pure logic, no canvas, so the same
// code can be play-tested headlessly in Node.

import { LEVEL_MAP, LEVEL_COLS, LEVEL_ROWS, TILE } from './config.js';

/** Turn the text map into a level: walls, bushes, fountain, keys, start and gate. */
export function parseLevel(map = LEVEL_MAP) {
  const walls = [];
  const bushes = [];
  const fountains = [];
  const keys = [];
  let playerStart = { x: TILE * 1.5, y: TILE * 1.5 };
  let gate = { x: TILE * 10.5, y: TILE * 15.5 };
  for (let row = 0; row < map.length; row += 1) {
    for (let col = 0; col < map[row].length; col += 1) {
      const ch = map[row][col];
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2;
      if (ch === '#') walls.push({ col, row });
      else if (ch === 'B') bushes.push({ col, row, x: cx, y: cy });
      else if (ch === '~') fountains.push({ col, row, x: cx, y: cy });
      else if (ch === 'K') keys.push({ col, row, x: cx, y: cy, taken: false });
      else if (ch === 'P') playerStart = { x: cx, y: cy };
      else if (ch === 'G') gate = { x: cx, y: cy, col, row };
    }
  }
  const wallSet = new Set(walls.map((w) => `${w.col},${w.row}`));
  const fountainSet = new Set(fountains.map((f) => `${f.col},${f.row}`));
  return { walls, wallSet, bushes, fountains, fountainSet, keys, playerStart, gate };
}

export function tileAt(level, x, y) {
  return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
}

export function inBounds(col, row) {
  return col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS;
}

/** A tile blocks movement when it is a hedge, the fountain, or off the map. */
export function blocksMovement(level, col, row) {
  if (!inBounds(col, row)) return true;
  return level.wallSet.has(`${col},${row}`) || level.fountainSet.has(`${col},${row}`);
}

/** A tile blocks sight when it is a hedge or off the map (bushes and water do not). */
export function blocksSight(level, col, row) {
  if (!inBounds(col, row)) return true;
  return level.wallSet.has(`${col},${row}`);
}

/** Is the point inside a bush tile? Bushes are the courier's cover. */
export function isInBush(level, x, y) {
  const { col, row } = tileAt(level, x, y);
  return level.bushes.some((b) => b.col === col && b.row === row);
}

/** Circle-versus-grid collision: slide the circle along walls instead of sticking. */
export function moveWithCollision(level, x, y, dx, dy, radius) {
  let nx = x + dx;
  if (!circleHitsWall(level, nx, y, radius)) x = nx;
  let ny = y + dy;
  if (!circleHitsWall(level, x, ny, radius)) y = ny;
  return { x, y };
}

export function circleHitsWall(level, x, y, radius) {
  const minCol = Math.floor((x - radius) / TILE);
  const maxCol = Math.floor((x + radius) / TILE);
  const minRow = Math.floor((y - radius) / TILE);
  const maxRow = Math.floor((y + radius) / TILE);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!blocksMovement(level, col, row)) continue;
      const closestX = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const closestY = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      const ddx = x - closestX;
      const ddy = y - closestY;
      if (ddx * ddx + ddy * ddy < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Does a straight line between two points cross a hedge? Steps along the line in
 * small increments and checks each sample's tile — the vision-cone test.
 */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const { col, row } = tileAt(level, x0 + dx * t, y0 + dy * t);
    if (blocksSight(level, col, row)) return false;
  }
  return true;
}

/** Breadth-first route across walkable tiles, from one tile to another. */
export function findPath(level, fromCol, fromRow, toCol, toRow) {
  if (!inBounds(toCol, toRow) || blocksMovement(level, toCol, toRow)) return null;
  const key = (c, r) => `${c},${r}`;
  const prev = new Map();
  const queue = [[fromCol, fromRow]];
  prev.set(key(fromCol, fromRow), null);
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    if (c === toCol && r === toRow) {
      const path = [];
      let cur = [c, r];
      while (cur) {
        path.unshift(cur);
        cur = prev.get(key(cur[0], cur[1]));
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!inBounds(nc, nr) || blocksMovement(level, nc, nr)) continue;
      if (prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), [c, r]);
      queue.push([nc, nr]);
    }
  }
  return null;
}

/** Cheapest route where tiles a warden can currently see cost far more to enter. */
export function findSafePath(level, fromCol, fromRow, toCol, toRow, dangerAt) {
  if (!inBounds(toCol, toRow) || blocksMovement(level, toCol, toRow)) return null;
  const key = (c, r) => `${c},${r}`;
  const cost = new Map([[key(fromCol, fromRow), 0]]);
  const prev = new Map([[key(fromCol, fromRow), null]]);
  const open = [[0, fromCol, fromRow]];
  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0]);
    const [, c, r] = open.shift();
    if (c === toCol && r === toRow) {
      const path = [];
      let cur = [c, r];
      while (cur) {
        path.unshift(cur);
        cur = prev.get(key(cur[0], cur[1]));
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!inBounds(nc, nr) || blocksMovement(level, nc, nr)) continue;
      const stepCost = 1 + (dangerAt(nc, nr) ? 25 : 0);
      const nc2 = cost.get(key(c, r)) + stepCost;
      if (cost.has(key(nc, nr)) && cost.get(key(nc, nr)) <= nc2) continue;
      cost.set(key(nc, nr), nc2);
      prev.set(key(nc, nr), [c, r]);
      open.push([nc2, nc, nr]);
    }
  }
  return null;
}
