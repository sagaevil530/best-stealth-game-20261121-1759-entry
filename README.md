# Wren — Shadow Courier

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/sagaevil530/best-stealth-game-20261121-1759-entry/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/sagaevil530/best-stealth-game-20261121-1759-entry/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down stealth game in a moonlit manor garden. You are Wren, a courier
hired to slip into the sleeping Marlowe Estate, pocket three silver lantern
keys, and leave by the south garden gate — unseen. Entry for the make.fun
competition `best-stealth-game-20261121-1759` — "Make the best stealth game",
$50 in USDC.

## Run it

```sh
npx serve game
```

Then open `game/index.html` in a desktop browser. No build step, no network.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>

## How it plays

- **The garden** is seen from above: hedges, lawns, stone paths, a fountain,
  and bushes to hide in.
- **Four wardens** (Bram, Odile, Fen and Marlowe) walk patrol routes with
  lantern-lit **vision cones**. A hedge blocks their sight; a bush hides you
  unless a warden comes very close.
- **Being seen fills the alarm.** A warden who half-sees you grows suspicious
  and comes to look; one who is sure gives chase. Break line of sight and the
  garden calms down — you always get a chance to recover.
- **Running is loud.** Wardens inside the noise ring hear your feet and come
  to investigate. Sneaking is slow and silent.
- **Pebbles** (Q or right-click, five per night) clatter where they land and
  pull a warden off his route — a distraction when a patrol blocks your way.
- **Three lantern keys** open the gate. Reach it with all three to finish the
  night. Get caught three times and the night is over. Your grade — GHOST,
  SHADOW or LOUD — depends on how quietly you did it.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| Shift | Run (faster, louder) |
| C | Sneak (slower, silent) |
| Click | Walk to that spot |
| Q / right-click | Toss a pebble toward the cursor |
| P / Esc | Pause |
| M | Mute |
| R | Play again (on the win / game-over screens) |
| Enter | Begin the night |

## Sound and music

All audio is synthesised live with WebAudio — footsteps, rustling bushes,
lantern chimes, alarm stings and a slow night pad. No audio files, no network.

## Running it

No build step, no network. Serve `game/` with any static server
(`node serve.ts`, then open http://localhost:8080) or open `game/index.html`
through a local server in desktop Chrome.

## Files

- `game/index.html` — the page
- `game/src/main.js` — boot, game loop, screens
- `game/src/config.js` — the garden map, patrols and tuning
- `game/src/level.js` — grid, collision, line of sight, pathfinding
- `game/src/entities.js` — courier, wardens, detection, noise, win/lose
- `game/src/render.js` — canvas drawing, lighting, HUD, screens
- `game/src/audio.js` — synthesised sounds and ambience
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=start|play|alert|win|over`)
- `main.ts` — hands the game, screenshots and dossier to `/output`
- `screenshots/` — four renders of the game itself, taken in headless Chrome

## License

MIT — see `LICENSE`.
