import test from "node:test";
import assert from "node:assert/strict";
import {
  COLS,
  HIDDEN_ROWS,
  PIECE_TYPES,
  ROWS,
  TetrisGame,
  clearCompleteLines,
  createBoard,
  lineClearScore,
  shuffledBag,
} from "../src/core.js";

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test("board has 20 visible rows plus hidden spawn rows", () => {
  const board = createBoard();
  assert.equal(board.length, ROWS);
  assert.equal(board.length - HIDDEN_ROWS, 20);
  assert.ok(board.every((row) => row.length === COLS && row.every((cell) => cell === null)));
});

test("a new piece spawns partly in the visible playfield", () => {
  const game = new TetrisGame({ random: () => 0.5 });
  assert.ok(game.active.y >= 0);
  assert.ok(game.active.y < HIDDEN_ROWS);
});

test("a shuffled 7-bag contains every tetromino exactly once", () => {
  const bag = shuffledBag(sequenceRandom([0.11, 0.72, 0.33, 0.96, 0.4, 0.61]));
  assert.equal(bag.length, 7);
  assert.deepEqual([...bag].sort(), [...PIECE_TYPES].sort());
});

test("queue emits complete, non-overlapping seven-piece bags", () => {
  const game = new TetrisGame({ random: () => 0.42 });
  const pieces = [game.active.type];
  for (let i = 0; i < 13; i += 1) {
    // Clear the board between locks so bag behavior is isolated.
    game.board = createBoard();
    game.active.y = game.getGhostY();
    game.lockPiece();
    pieces.push(game.active.type);
  }
  assert.deepEqual([...pieces.slice(0, 7)].sort(), [...PIECE_TYPES].sort());
  assert.deepEqual([...pieces.slice(7, 14)].sort(), [...PIECE_TYPES].sort());
});

test("complete rows clear and are replaced at the top", () => {
  const board = createBoard();
  board[ROWS - 1].fill("T");
  board[ROWS - 2][3] = "I";
  const result = clearCompleteLines(board);
  assert.deepEqual(result.clearedRows, [ROWS - 1]);
  assert.ok(result.board[0].every((cell) => cell === null));
  assert.equal(result.board[ROWS - 1][3], "I");
});

test("guideline line clear scores scale with level", () => {
  assert.equal(lineClearScore(1, 3), 300);
  assert.equal(lineClearScore(2, 3), 900);
  assert.equal(lineClearScore(3, 3), 1500);
  assert.equal(lineClearScore(4, 3), 2400);
});

test("hard drop lands, awards two points per cell, and spawns a new piece", () => {
  const game = new TetrisGame({ random: () => 0.5 });
  const first = game.active.type;
  const distance = game.getGhostY() - game.active.y;
  const event = game.hardDrop();
  assert.equal(event.distance, distance);
  assert.equal(game.score, distance * 2);
  assert.notEqual(game.active.type, undefined);
  assert.ok(game.board.some((row) => row.includes(first)));
});

test("hold is allowed only once until the active piece locks", () => {
  const game = new TetrisGame({ random: sequenceRandom([0.2, 0.8, 0.4, 0.6]) });
  const first = game.active.type;
  assert.equal(game.hold(), true);
  assert.equal(game.held, first);
  const activeAfterHold = game.active.type;
  assert.equal(game.hold(), false);
  assert.equal(game.active.type, activeAfterHold);
  game.board = createBoard();
  game.active.y = game.getGhostY();
  game.lockPiece();
  assert.equal(game.hold(), true);
});

test("rotation uses a wall kick when the un-kicked rotation is obstructed", () => {
  const game = new TetrisGame({ random: () => 0.5 });
  game.board = createBoard();
  game.active = { type: "T", rotation: 1, x: -1, y: 5 };
  assert.equal(game.rotate(-1), true);
  assert.equal(game.active.rotation, 0);
  assert.equal(game.active.x, 0);
});

test("soft drop moves one row and awards one point", () => {
  const game = new TetrisGame();
  const y = game.active.y;
  assert.equal(game.softDrop(), true);
  assert.equal(game.active.y, y + 1);
  assert.equal(game.score, 1);
});

test("locking in hidden spawn rows ends the game", () => {
  const game = new TetrisGame();
  game.board = createBoard();
  game.active = { type: "O", rotation: 0, x: 3, y: 0 };
  game.board[2][4] = "Z";
  game.board[2][5] = "Z";
  const event = game.lockPiece();
  assert.equal(event.gameOver, true);
  assert.equal(game.gameOver, true);
});
