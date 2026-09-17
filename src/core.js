export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 2;
export const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
export const PIECE_TYPES = Object.freeze(["I", "J", "L", "O", "S", "T", "Z"]);

// Coordinates are expressed in each tetromino's SRS bounding box.
export const SHAPES = Object.freeze({
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
});

// Guideline SRS kick offsets, converted to canvas coordinates (+y points down).
const JLSTZ_KICKS = Object.freeze({
  "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
});

const I_KICKS = Object.freeze({
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
});

export function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function shuffledBag(random = Math.random) {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function cellsFor(piece) {
  return SHAPES[piece.type][piece.rotation].map(([x, y]) => [piece.x + x, piece.y + y]);
}

export function clearCompleteLines(board) {
  const clearedRows = [];
  const kept = [];
  board.forEach((row, index) => {
    if (row.every(Boolean)) clearedRows.push(index);
    else kept.push([...row]);
  });
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));
  return { board: kept, clearedRows };
}

export function lineClearScore(lines, level) {
  return ([0, 100, 300, 500, 800][lines] ?? 0) * level;
}

export class TetrisGame {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.board = createBoard();
    this.bag = [];
    this.next = [];
    this.active = null;
    this.held = null;
    this.holdUsed = false;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.lastEvent = null;
    this.#fillQueue();
    this.#spawn(this.#takeNext());
  }

  #fillQueue() {
    while (this.next.length < 6) {
      if (this.bag.length === 0) this.bag = shuffledBag(this.random);
      this.next.push(this.bag.shift());
    }
  }

  #takeNext() {
    this.#fillQueue();
    const type = this.next.shift();
    this.#fillQueue();
    return type;
  }

  #spawn(type) {
    // One row remains hidden while the lower half enters the visible playfield.
    this.active = { type, rotation: 0, x: 3, y: 1 };
    if (this.collides(this.active)) this.gameOver = true;
  }

  collides(piece = this.active) {
    return cellsFor(piece).some(([x, y]) =>
      x < 0 || x >= COLS || y >= ROWS || (y >= 0 && Boolean(this.board[y][x])),
    );
  }

  move(dx, dy) {
    if (this.gameOver || !this.active) return false;
    const candidate = { ...this.active, x: this.active.x + dx, y: this.active.y + dy };
    if (this.collides(candidate)) return false;
    this.active = candidate;
    return true;
  }

  rotate(direction = 1) {
    if (this.gameOver || !this.active) return false;
    const from = this.active.rotation;
    const to = (from + (direction > 0 ? 1 : 3)) % 4;
    const table = this.active.type === "I" ? I_KICKS : JLSTZ_KICKS;
    const kicks = this.active.type === "O" ? [[0, 0]] : table[`${from}>${to}`];

    for (const [dx, dy] of kicks) {
      const candidate = { ...this.active, rotation: to, x: this.active.x + dx, y: this.active.y + dy };
      if (!this.collides(candidate)) {
        this.active = candidate;
        return true;
      }
    }
    return false;
  }

  getGhostY() {
    if (!this.active) return 0;
    let y = this.active.y;
    while (!this.collides({ ...this.active, y: y + 1 })) y += 1;
    return y;
  }

  isGrounded() {
    return Boolean(this.active) && this.collides({ ...this.active, y: this.active.y + 1 });
  }

  softDrop() {
    if (!this.move(0, 1)) return false;
    this.score += 1;
    return true;
  }

  hardDrop() {
    if (this.gameOver || !this.active) return null;
    const distance = this.getGhostY() - this.active.y;
    this.active.y += distance;
    this.score += distance * 2;
    return { distance, ...this.lockPiece() };
  }

  hold() {
    if (this.gameOver || !this.active || this.holdUsed) return false;
    const outgoing = this.active.type;
    if (this.held === null) {
      this.held = outgoing;
      this.#spawn(this.#takeNext());
    } else {
      const incoming = this.held;
      this.held = outgoing;
      this.#spawn(incoming);
    }
    this.holdUsed = true;
    return true;
  }

  lockPiece() {
    if (this.gameOver || !this.active) return { lines: 0, clearedRows: [], scoreGain: 0, gameOver: this.gameOver };

    let lockedAboveBoard = false;
    for (const [x, y] of cellsFor(this.active)) {
      if (y < 0) lockedAboveBoard = true;
      else this.board[y][x] = this.active.type;
    }

    const cleared = clearCompleteLines(this.board);
    this.board = cleared.board;
    const count = cleared.clearedRows.length;
    const scoreGain = lineClearScore(count, this.level);
    this.score += scoreGain;
    this.lines += count;
    this.level = Math.floor(this.lines / 10) + 1;
    this.holdUsed = false;

    // Locking in hidden spawn rows is a block-out even if a line below clears.
    if (lockedAboveBoard || cellsFor(this.active).some(([, y]) => y < HIDDEN_ROWS)) {
      this.gameOver = true;
    } else {
      this.#spawn(this.#takeNext());
    }

    const event = { lines: count, clearedRows: cleared.clearedRows, scoreGain, gameOver: this.gameOver };
    this.lastEvent = event;
    return event;
  }
}
