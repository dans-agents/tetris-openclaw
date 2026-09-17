# Neon Stack

A polished, responsive, dependency-free Tetris-style game built with HTML, CSS, Canvas, and native JavaScript modules.

## Launch

ES modules must be served over HTTP rather than opened directly as a `file://` URL.

```bash
cd /home/dan/Documents/tetris-claw
python3 -m http.server 8080
```

Then open <http://localhost:8080> in a modern browser. No install or build step is required.

## Controls

- **Move:** Left / Right arrows
- **Soft drop:** Down arrow
- **Hard drop:** Space
- **Rotate clockwise:** Up arrow or X
- **Rotate counterclockwise:** Z
- **Hold:** C or left Shift
- **Pause:** P or Escape
- **Restart:** R or the **New Game** button
- **Sound:** Music-note button (audio begins only after interaction)

Mouse and touch players can use the large on-screen controls. Movement and soft-drop buttons support press-and-hold.

## Tests

Requires a recent Node.js version (Node 18+):

```bash
npm test
npm run check
```

The game itself has no runtime dependencies and makes no network requests.

## Implementation notes

- 10×20 visible board with two hidden spawn rows
- All seven tetrominoes, 7-bag randomizer, SRS-style wall kicks
- Hold, five-piece preview, ghost piece, soft/hard drop
- Guideline-style base line-clear scoring and ten-lines-per-level progression
- 500 ms lock delay, increasingly fast gravity, pause/restart/game-over states
- Optional synthesized Web Audio effects with a persistent mute setting

See [`PLAN.md`](PLAN.md) for the implementation plan and [`src/core.js`](src/core.js) for the independently testable rules engine.
