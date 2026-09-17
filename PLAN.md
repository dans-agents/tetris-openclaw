# Implementation Plan

## Architecture

- Build a dependency-free browser app using semantic HTML, responsive CSS, and native ES modules.
- Keep deterministic game rules in `src/core.js` with no DOM dependencies so they can be unit tested in Node.
- Keep rendering, input, timing, audio, and UI state in `src/app.js`.
- Use a fixed logical canvas size and scale it with CSS for crisp, responsive rendering.

## Gameplay

1. Model a 10×20 visible board with 2 hidden spawn rows.
2. Define all seven tetrominoes, SRS rotation states, JLSTZ/I wall-kick tables, and O-piece behavior.
3. Implement collision detection, 7-bag randomization, next queue, ghost projection, hold-once-per-lock, line clears, lock delay, scoring, levels, gravity, soft drop, and hard drop.
4. Support pause, restart, game-over, and keyboard input with repeat behavior suitable for play.
5. Add prominent on-screen controls for pointer/touch users, including press-and-hold movement/drop controls.

## Presentation

- Render the board, ghost, active piece, grid, line-clear flash, particles, screen shake, and status overlays on canvas.
- Show hold, five-piece next queue, score, level, lines, and a concise controls guide.
- Add a restrained neon/arcade visual system that remains legible on small screens and desktop Linux.
- Generate optional Web Audio effects lazily after user interaction, with a persistent mute control and graceful no-audio fallback.

## Quality and Verification

- Add Node built-in unit tests for rotations/kicks, line clearing, scoring, 7-bag behavior, hold restrictions, drops, and game-over boundaries.
- Add launch and control instructions to `README.md`.
- Run the test suite, syntax checks, and a local HTTP smoke check without introducing external dependencies.
