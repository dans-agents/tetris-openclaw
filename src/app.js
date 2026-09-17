import {
  COLS,
  HIDDEN_ROWS,
  SHAPES,
  TetrisGame,
  VISIBLE_ROWS,
  cellsFor,
} from "./core.js";

const LOGICAL_WIDTH = 320;
const LOGICAL_HEIGHT = 640;
const CELL = LOGICAL_WIDTH / COLS;
const LOCK_DELAY = 500;
const COLORS = {
  I: "#2eeaf2",
  J: "#5472ff",
  L: "#ff9f43",
  O: "#ffe14a",
  S: "#55e57b",
  T: "#c86bff",
  Z: "#ff5370",
};

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const boardFrame = document.querySelector("#boardFrame");
const scoreValue = document.querySelector("#scoreValue");
const levelValue = document.querySelector("#levelValue");
const linesValue = document.querySelector("#linesValue");
const holdPiece = document.querySelector("#holdPiece");
const nextQueue = document.querySelector("#nextQueue");
const pauseButton = document.querySelector("#pauseButton");
const muteButton = document.querySelector("#muteButton");
const restartButton = document.querySelector("#restartButton");
const statusOverlay = document.querySelector("#statusOverlay");
const statusKicker = document.querySelector("#statusKicker");
const statusTitle = document.querySelector("#statusTitle");
const statusMessage = document.querySelector("#statusMessage");
const overlayButton = document.querySelector("#overlayButton");

let game = new TetrisGame();
let mode = "playing";
let lastTime = performance.now();
let gravityElapsed = 0;
let lockElapsed = 0;
let lastRenderedQueue = "";
let lastHeld = undefined;
let clearFlash = null;
let shakeUntil = 0;
let particles = [];
let muted = false;
try {
  muted = localStorage.getItem("neon-stack-muted") === "true";
} catch {
  // Storage can be unavailable in hardened/private browser contexts.
}

const heldInputs = new Map();

class SoundEngine {
  constructor() {
    this.context = null;
  }

  ensure() {
    if (muted) return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return this.context;
  }

  tone(frequency, duration = 0.05, type = "square", volume = 0.025, endFrequency = frequency) {
    const audio = this.ensure();
    if (!audio) return;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  move() { this.tone(150, 0.025, "square", 0.012, 130); }
  rotate() { this.tone(320, 0.055, "triangle", 0.02, 500); }
  hold() { this.tone(220, 0.09, "sine", 0.025, 440); }
  drop() { this.tone(100, 0.1, "sawtooth", 0.035, 45); }
  clear(lines) {
    [0, 1, 2].forEach((step) => setTimeout(() => this.tone(330 + lines * 45 + step * 100, 0.11, "triangle", 0.035), step * 55));
  }
  over() { this.tone(240, 0.55, "sawtooth", 0.04, 55); }
}

const sound = new SoundEngine();

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function hexToRgba(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function drawBlock(x, visibleY, type, { ghost = false, alpha = 1 } = {}) {
  if (visibleY < 0 || visibleY >= VISIBLE_ROWS) return;
  const px = x * CELL;
  const py = visibleY * CELL;
  const color = COLORS[type];

  ctx.save();
  ctx.globalAlpha = alpha;
  if (ghost) {
    ctx.strokeStyle = hexToRgba(color, 0.75);
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(px + 4, py + 4, CELL - 8, CELL - 8);
    ctx.fillStyle = hexToRgba(color, 0.07);
    ctx.fillRect(px + 5, py + 5, CELL - 10, CELL - 10);
  } else {
    const gradient = ctx.createLinearGradient(px, py, px + CELL, py + CELL);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, hexToRgba(color, 0.66));
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = gradient;
    ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(px + 4, py + 4, CELL - 8, 3);
    ctx.fillRect(px + 4, py + 7, 3, CELL - 11);
    ctx.strokeStyle = "rgba(3,5,18,.42)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 2.5, py + 2.5, CELL - 5, CELL - 5);
  }
  ctx.restore();
}

function drawBoard(now) {
  resizeCanvas();
  ctx.setTransform(canvas.width / LOGICAL_WIDTH, 0, 0, canvas.height / LOGICAL_HEIGHT, 0, 0);
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const background = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
  background.addColorStop(0, "#0e1730");
  background.addColorStop(1, "#070b17");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  ctx.strokeStyle = "rgba(91, 116, 169, .10)";
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x += 1) {
    ctx.beginPath(); ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, LOGICAL_HEIGHT); ctx.stroke();
  }
  for (let y = 1; y < VISIBLE_ROWS; y += 1) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(LOGICAL_WIDTH, y * CELL + 0.5); ctx.stroke();
  }

  game.board.slice(HIDDEN_ROWS).forEach((row, y) => {
    row.forEach((type, x) => { if (type) drawBlock(x, y, type); });
  });

  if (game.active && !game.gameOver) {
    const ghost = { ...game.active, y: game.getGhostY() };
    cellsFor(ghost).forEach(([x, y]) => drawBlock(x, y - HIDDEN_ROWS, ghost.type, { ghost: true }));
    cellsFor(game.active).forEach(([x, y]) => drawBlock(x, y - HIDDEN_ROWS, game.active.type));
  }

  if (clearFlash && now < clearFlash.until) {
    const alpha = (clearFlash.until - now) / 220;
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
    clearFlash.rows.forEach((row) => {
      const y = row - HIDDEN_ROWS;
      if (y >= 0) ctx.fillRect(0, y * CELL, LOGICAL_WIDTH, CELL);
    });
  }

  particles = particles.filter((particle) => now < particle.until);
  particles.forEach((particle) => {
    const progress = 1 - (particle.until - now) / particle.life;
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x + particle.vx * progress, particle.y + particle.vy * progress + 30 * progress * progress, particle.size, particle.size);
  });
  ctx.globalAlpha = 1;
}

function renderMini(container, type, compact = false) {
  container.replaceChildren();
  container.classList.toggle("empty", !type);
  if (!type) {
    const mark = document.createElement("span");
    mark.className = "empty-mark";
    mark.textContent = "—";
    container.append(mark);
    return;
  }

  const grid = document.createElement("div");
  grid.className = `piece-grid${compact ? " compact" : ""}`;
  grid.setAttribute("aria-label", `${type} piece`);
  const occupied = new Set(SHAPES[type][0].map(([x, y]) => `${x},${y}`));
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const cell = document.createElement("span");
      if (occupied.has(`${x},${y}`)) {
        cell.className = "filled";
        cell.style.setProperty("--piece-color", COLORS[type]);
      }
      grid.append(cell);
    }
  }
  container.append(grid);
}

function updateUI() {
  scoreValue.textContent = String(game.score).padStart(6, "0");
  levelValue.textContent = String(game.level).padStart(2, "0");
  linesValue.textContent = String(game.lines).padStart(3, "0");

  if (lastHeld !== game.held) {
    renderMini(holdPiece, game.held);
    holdPiece.setAttribute("aria-label", game.held ? `Held ${game.held} piece` : "No held piece");
    lastHeld = game.held;
  }

  const queueKey = game.next.slice(0, 5).join("");
  if (lastRenderedQueue !== queueKey) {
    nextQueue.replaceChildren();
    game.next.slice(0, 5).forEach((type, index) => {
      const row = document.createElement("div");
      row.className = `next-item${index === 0 ? " current" : ""}`;
      const indexLabel = document.createElement("span");
      indexLabel.className = "next-index";
      indexLabel.textContent = String(index + 1).padStart(2, "0");
      const preview = document.createElement("div");
      preview.className = "mini-piece";
      renderMini(preview, type, index > 0);
      row.append(indexLabel, preview);
      nextQueue.append(row);
    });
    lastRenderedQueue = queueKey;
  }

  holdPiece.classList.toggle("used", game.holdUsed);
  muteButton.classList.toggle("active", muted);
  muteButton.querySelector("span").textContent = muted ? "×" : "♪";
  muteButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  pauseButton.querySelector("span").textContent = mode === "paused" ? "▶" : "Ⅱ";
  pauseButton.setAttribute("aria-label", mode === "paused" ? "Resume game" : "Pause game");
}

function showOverlay(kind) {
  if (kind === "playing") {
    statusOverlay.hidden = true;
    return;
  }
  statusOverlay.hidden = false;
  if (kind === "paused") {
    statusKicker.textContent = "SYSTEM PAUSED";
    statusTitle.textContent = "PAUSED";
    statusMessage.textContent = "Press P or tap resume";
    overlayButton.textContent = "RESUME";
  } else {
    statusKicker.textContent = "STACK OVERFLOW";
    statusTitle.textContent = "GAME OVER";
    statusMessage.textContent = `Final score ${String(game.score).padStart(6, "0")}`;
    overlayButton.textContent = "PLAY AGAIN";
  }
}

function spawnParticles(rows, now) {
  rows.forEach((boardRow) => {
    const y = (boardRow - HIDDEN_ROWS + 0.5) * CELL;
    for (let i = 0; i < 18; i += 1) {
      const life = 350 + Math.random() * 250;
      particles.push({
        x: Math.random() * LOGICAL_WIDTH,
        y,
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.7) * 100,
        size: 2 + Math.random() * 5,
        color: ["#fff", "#36e7ff", "#bd69ff"][i % 3],
        life,
        until: now + life,
      });
    }
  });
}

function processLock(event, now = performance.now()) {
  gravityElapsed = 0;
  lockElapsed = 0;
  if (event.lines > 0) {
    clearFlash = { rows: event.clearedRows, until: now + 220 };
    shakeUntil = now + Math.min(260, 90 + event.lines * 45);
    spawnParticles(event.clearedRows, now);
    sound.clear(event.lines);
  }
  if (event.gameOver) {
    mode = "gameover";
    sound.over();
    showOverlay(mode);
  }
  updateUI();
}

function resetGame() {
  game = new TetrisGame();
  mode = "playing";
  gravityElapsed = 0;
  lockElapsed = 0;
  clearFlash = null;
  particles = [];
  lastRenderedQueue = "";
  lastHeld = undefined;
  heldInputs.clear();
  showOverlay(mode);
  updateUI();
}

function togglePause() {
  if (mode === "gameover") return;
  mode = mode === "paused" ? "playing" : "paused";
  heldInputs.clear();
  lastTime = performance.now();
  showOverlay(mode);
  updateUI();
}

function act(action) {
  sound.ensure();
  if (action === "pause") { togglePause(); return; }
  if (action === "restart") { resetGame(); return; }
  if (mode !== "playing") return;

  let changed = false;
  if (action === "left") changed = game.move(-1, 0);
  if (action === "right") changed = game.move(1, 0);
  if (action === "soft") changed = game.softDrop();
  if (action === "rotateCW") changed = game.rotate(1);
  if (action === "rotateCCW") changed = game.rotate(-1);
  if (action === "hold") changed = game.hold();

  if (changed) {
    if (action.startsWith("rotate")) sound.rotate();
    else if (action === "hold") sound.hold();
    else sound.move();
    if (action !== "soft") lockElapsed = 0;
    updateUI();
    if (game.gameOver) {
      mode = "gameover";
      sound.over();
      showOverlay(mode);
    }
  }

  if (action === "hard") {
    const event = game.hardDrop();
    if (event) {
      sound.drop();
      shakeUntil = performance.now() + 75;
      processLock(event);
    }
  }
}

const keyActions = new Map([
  ["ArrowLeft", "left"], ["ArrowRight", "right"], ["ArrowDown", "soft"],
  ["ArrowUp", "rotateCW"], ["KeyX", "rotateCW"], ["KeyZ", "rotateCCW"],
  ["Space", "hard"], ["KeyC", "hold"], ["ShiftLeft", "hold"],
  ["KeyP", "pause"], ["Escape", "pause"], ["KeyR", "restart"],
]);
const repeatable = new Set(["left", "right", "soft"]);

window.addEventListener("keydown", (event) => {
  const action = keyActions.get(event.code);
  if (!action) return;
  event.preventDefault();
  if (event.repeat) return;
  act(action);
  if (repeatable.has(action)) heldInputs.set(action, { elapsed: 0, repeated: false });
});

window.addEventListener("keyup", (event) => {
  const action = keyActions.get(event.code);
  if (action) heldInputs.delete(action);
});

window.addEventListener("blur", () => {
  heldInputs.clear();
  if (mode === "playing") togglePause();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  const action = button.dataset.action;
  const release = () => {
    heldInputs.delete(action);
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.classList.add("pressed");
    act(action);
    if (button.hasAttribute("data-repeat")) heldInputs.set(action, { elapsed: 0, repeated: false });
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

pauseButton.addEventListener("click", () => act("pause"));
restartButton.addEventListener("click", () => act("restart"));
overlayButton.addEventListener("click", () => act(mode === "gameover" ? "restart" : "pause"));
muteButton.addEventListener("click", () => {
  muted = !muted;
  try {
    localStorage.setItem("neon-stack-muted", String(muted));
  } catch {
    // Muting still works for the current session when storage is unavailable.
  }
  if (!muted) sound.ensure();
  updateUI();
});

function updateRepeats(dt) {
  heldInputs.forEach((state, action) => {
    state.elapsed += dt;
    const delay = action === "soft" ? 70 : 145;
    const interval = action === "soft" ? 35 : 45;
    if (state.elapsed >= delay) {
      const repeatTime = state.elapsed - delay;
      const shouldRepeat = !state.repeated || repeatTime >= interval;
      if (shouldRepeat) {
        act(action);
        state.repeated = true;
        state.elapsed = delay + (repeatTime % interval);
      }
    }
  });
}

function gravityInterval(level) {
  return Math.max(70, 900 * (0.82 ** (level - 1)));
}

function update(now) {
  const dt = Math.min(now - lastTime, 100);
  lastTime = now;

  if (mode === "playing") {
    updateRepeats(dt);
    if (game.isGrounded()) {
      lockElapsed += dt;
      if (lockElapsed >= LOCK_DELAY) processLock(game.lockPiece(), now);
    } else {
      lockElapsed = 0;
      gravityElapsed += dt;
      const interval = gravityInterval(game.level);
      while (gravityElapsed >= interval && mode === "playing") {
        gravityElapsed -= interval;
        if (!game.move(0, 1)) break;
      }
    }
  }

  if (now < shakeUntil) {
    const strength = Math.max(1, ((shakeUntil - now) / 80) * 3);
    boardFrame.style.transform = `translate(${(Math.random() - 0.5) * strength}px, ${(Math.random() - 0.5) * strength}px)`;
  } else {
    boardFrame.style.transform = "";
  }

  drawBoard(now);
  requestAnimationFrame(update);
}

new ResizeObserver(resizeCanvas).observe(canvas);
updateUI();
showOverlay(mode);
requestAnimationFrame((now) => {
  lastTime = now;
  update(now);
});
