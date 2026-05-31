// ======================== 五子棋 Game Logic ========================

const BOARD_SIZE = 15;
const EMPTY = 0, BLACK = 1, WHITE = 2;

class GomokuGame {
  constructor() {
    this.board = [];
    this.currentPlayer = BLACK;
    this.history = [];
    this.gameOver = false;
    this.winner = null;
    this.mode = 'pvp'; // 'pvp' or 'pvc'
    this.difficulty = 'medium';
    this.scores = { black: 0, white: 0 };
    this.aiThinking = false;
    this.moveCount = 0;
    this.lastMove = null;
    this.aiPlayer = WHITE;
    this.humanPlayer = BLACK;
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
    this.currentPlayer = BLACK;
    this.history = [];
    this.gameOver = false;
    this.winner = null;
    this.moveCount = 0;
    this.lastMove = null;
    this.aiThinking = false;
  }

  place(row, col, skipSwitch) {
    if (this.gameOver || this.aiThinking) return false;
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
    if (this.board[row][col] !== EMPTY) return false;

    this.board[row][col] = this.currentPlayer;
    this.history.push({ row, col, player: this.currentPlayer });
    this.lastMove = { row, col };
    this.moveCount++;

    if (this.checkWin(row, col, this.currentPlayer)) {
      this.gameOver = true;
      this.winner = this.currentPlayer;
      if (this.currentPlayer === BLACK) this.scores.black++;
      else this.scores.white++;
      return true;
    }

    if (this.moveCount >= BOARD_SIZE * BOARD_SIZE) {
      this.gameOver = true;
      this.winner = null;
      return true;
    }

    if (!skipSwitch) {
      this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
    }
    return true;
  }

  undo() {
    if (this.history.length === 0 || this.aiThinking) return false;
    const steps = this.mode === 'pvc' && this.history.length >= 2 ? 2 : 1;
    for (let i = 0; i < steps; i++) {
      const move = this.history.pop();
      if (move) {
        this.board[move.row][move.col] = EMPTY;
        this.moveCount--;
      }
    }
    this.gameOver = false;
    this.winner = null;
    this.currentPlayer = this.history.length % 2 === 0 ? BLACK : WHITE;
    this.lastMove = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    return true;
  }

  checkWin(row, col, player) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) {
      let count = 1;
      for (let i = 1; i < 5; i++) {
        const r = row + dx * i, c = col + dy * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== player) break;
        count++;
      }
      for (let i = 1; i < 5; i++) {
        const r = row - dx * i, c = col - dy * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== player) break;
        count++;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  getWinLine(row, col, player) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) {
      const cells = [{ row, col }];
      for (let i = 1; i < 5; i++) {
        const r = row + dx * i, c = col + dy * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== player) break;
        cells.push({ row: r, col: c });
      }
      for (let i = 1; i < 5; i++) {
        const r = row - dx * i, c = col - dy * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== player) break;
        cells.push({ row: r, col: c });
      }
      if (cells.length >= 5) return cells;
    }
    return [];
  }

  // ==================== AI ====================

  hasNeighbor(row, col, dist) {
    for (let dr = -dist; dr <= dist; dr++) {
      for (let dc = -dist; dc <= dist; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
        if (this.board[r][c] !== EMPTY) return true;
      }
    }
    return false;
  }

  analyzeDir(r, c, dx, dy, p) {
    let cnt = 1, open = 0;
    for (let i = 1; i <= 4; i++) {
      const nr = r + dx * i, nc = c + dy * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (this.board[nr][nc] === p) cnt++;
      else if (this.board[nr][nc] === EMPTY) { open++; break; }
      else break;
    }
    for (let i = 1; i <= 4; i++) {
      const nr = r - dx * i, nc = c - dy * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (this.board[nr][nc] === p) cnt++;
      else if (this.board[nr][nc] === EMPTY) { open++; break; }
      else break;
    }
    return { cnt, open };
  }

  evaluatePosition(row, col, player) {
    let score = 0;
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) {
      const { cnt, open } = this.analyzeDir(row, col, dx, dy, player);
      if (cnt >= 5) score += 1000000;
      else if (cnt === 4) score += open === 2 ? 100000 : 10000;
      else if (cnt === 3) score += open === 2 ? 5000 : 500;
      else if (cnt === 2) score += open === 2 ? 200 : 50;
      else if (cnt === 1) score += open === 2 ? 10 : 3;
    }
    return score;
  }

  // ---- EASY ----
  aiEasy() {
    const best = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== EMPTY || !this.hasNeighbor(r, c, 2)) continue;
        const off = this.evaluatePosition(r, c, WHITE);
        const def = this.evaluatePosition(r, c, BLACK);
        let s = Math.max(off, def) + Math.random() * 3000;
        s += (7 - Math.abs(r - 7)) * 2 + (7 - Math.abs(c - 7)) * 2;
        best.push({ r, c, s });
      }
    }
    if (best.length === 0) return { r: 7, c: 7 };
    best.sort((a, b) => b.s - a.s);
    if (Math.random() < 0.3 && best.length > 2) return best[Math.floor(Math.random() * Math.min(5, best.length))];
    const prev = this.history.length >= 2 ? this.history[this.history.length - 2] : null;
    if (prev && Math.random() < 0.2) return { r: prev.row + (Math.random() < 0.5 ? 1 : -1), c: prev.col + (Math.random() < 0.5 ? 1 : -1) };
    return best[0];
  }

  // ---- MEDIUM ----
  aiMedium() {
    let bestS = -1;
    const best = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== EMPTY || !this.hasNeighbor(r, c, 2)) continue;
        const off = this.evaluatePosition(r, c, WHITE);
        const def = this.evaluatePosition(r, c, BLACK);
        let s = 0;
        if (off >= 100000) s = off * 1.5;
        else if (def >= 100000) s = def * 1.3;
        else s = off * 1.1 + def;
        s += (7 - Math.abs(r - 7)) * 5 + (7 - Math.abs(c - 7)) * 5;
        if (s > bestS) { bestS = s; best.length = 0; best.push({ r, c }); }
        else if (s === bestS) best.push({ r, c });
      }
    }
    if (best.length === 0) return { r: 7, c: 7 };
    return best[Math.floor(Math.random() * best.length)];
  }

  // ---- HARD ----
  aiHard() {
    let bestS = -Infinity;
    let best = { r: 7, c: 7 };
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== EMPTY || !this.hasNeighbor(r, c, 2)) continue;
        const off = this.evaluatePosition(r, c, WHITE);
        const def = this.evaluatePosition(r, c, BLACK);
        let s = 0;
        if (off >= 1000000) s = 10000000;
        else if (def >= 1000000) s = 9000000;
        else if (off >= 100000) s = 800000 + off;
        else if (def >= 100000) s = 700000 + def;
        else if (off >= 5000) s = 500000 + off;
        else if (def >= 5000) s = 400000 + def;
        else {
          s = off * 1.2 + def * 1.0;
          const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
          for (const [dx, dy] of dirs) {
            const a = this.analyzeDir(r, c, dx, dy, WHITE);
            const d = this.analyzeDir(r, c, dx, dy, BLACK);
            if (a.cnt >= 3 && a.open >= 1) s += 300;
            if (d.cnt >= 3 && d.open >= 1) s += 200;
          }
        }
        s += (7 - Math.abs(r - 7)) * 8 + (7 - Math.abs(c - 7)) * 8;
        if (s > bestS) { bestS = s; best = { r, c }; }
      }
    }
    return best;
  }

  // ---- AI ENTRY ----
  aiMove() {
    if (this.gameOver || this.currentPlayer !== this.aiPlayer) return;
    console.log('[AI] triggered, difficulty:', this.difficulty);
    this.aiThinking = true;
    updateStatus();

    // Use requestAnimationFrame for smooth UI update before AI computation
    requestAnimationFrame(() => {
      let move;
      const label = this.difficulty;
      if (label === 'easy') move = this.aiEasy();
      else if (label === 'hard') move = this.aiHard();
      else move = this.aiMedium();
      console.log('[AI] chose:', move.r, move.c);

      const delay = label === 'easy' ? 150 : label === 'hard' ? 500 : 300;

      setTimeout(() => {
        this.place(move.r, move.c);
        this.aiThinking = false;
        if (this.gameOver) {
          render();
          setTimeout(showWinModal, 400);
        } else {
          this.currentPlayer = BLACK;
          render();
        }
      }, delay);
    });
  }
}

// ======================== BGM with Web Audio API ========================

class GomokuBGM {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.osc = null;
    this.gain = null;
    this.sequence = [];
    this.index = 0;
    this.timer = null;
    this.volume = 0.08;
  }

  // Pentatonic scale notes (frequencies)
  static NOTES = {
    C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
    C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00, A3: 220.00,
  };

  // A gentle pentatonic melody (Chinese-style)
  static MELODY = [
    { note: 'C4', dur: 0.4 }, { note: 'E4', dur: 0.4 }, { note: 'G4', dur: 0.4 },
    { note: 'A4', dur: 0.6 }, { note: 'G4', dur: 0.3 }, { note: 'E4', dur: 0.3 },
    { note: 'D4', dur: 0.5 }, { note: 'C4', dur: 0.3 },
    { note: 'D4', dur: 0.4 }, { note: 'E4', dur: 0.4 }, { note: 'G4', dur: 0.4 },
    { note: 'A4', dur: 0.6 }, { note: 'C5', dur: 0.5 }, { note: 'A4', dur: 0.3 },
    { note: 'G4', dur: 0.8 },
    // Bass accompaniment
    { note: 'C3', dur: 0.8 }, { note: 'G3', dur: 0.8 },
    { note: 'A3', dur: 0.5 }, { note: 'E3', dur: 0.5 }, { note: 'G3', dur: 0.6 },
    { note: 'C3', dur: 0.8 },
    // Variation
    { note: 'E4', dur: 0.4 }, { note: 'G4', dur: 0.4 }, { note: 'A4', dur: 0.4 },
    { note: 'G4', dur: 0.5 }, { note: 'E4', dur: 0.3 }, { note: 'D4', dur: 0.4 },
    { note: 'C4', dur: 0.7 }, { rest: true, dur: 0.3 },
    { note: 'D4', dur: 0.4 }, { note: 'E4', dur: 0.4 }, { note: 'G4', dur: 0.4 },
    { note: 'A4', dur: 0.6 }, { note: 'G4', dur: 0.5 }, { note: 'E4', dur: 0.5 },
    { note: 'C4', dur: 1.0 },
  ];

  start() {
    if (this.playing) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.playing = true;
      this.index = 0;
      this.playNext();
    } catch (e) {
      console.log('[BGM] Audio not supported');
    }
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.osc) { try { this.osc.stop(); } catch(e) {} this.osc = null; }
    if (this.gain) { this.gain = null; }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  playNext() {
    if (!this.playing || !this.ctx) return;

    const note = GomokuBGM.MELODY[this.index % GomokuBGM.MELODY.length];
    this.index++;

    if (note.rest) {
      this.timer = setTimeout(() => this.playNext(), note.dur * 1000);
      return;
    }

    const freq = GomokuBGM.NOTES[note.note];
    if (!freq) { this.timer = setTimeout(() => this.playNext(), 100); return; }

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Soft sine wave with slight harmonics
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(this.volume * 0.7, this.ctx.currentTime + note.dur * 0.6);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + note.dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + note.dur);

      this.osc = osc;
      this.gain = gain;
    } catch(e) {
      // ignore audio errors
    }

    this.timer = setTimeout(() => this.playNext(), note.dur * 1000);
  }

  toggle() {
    if (this.playing) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }
}

// ======================== Rendering ========================

const canvas = document.getElementById('boardCanvas');
const ctx = canvas.getContext('2d');
const game = new GomokuGame();
const bgm = new GomokuBGM();

const PADDING = 30;
const CELL_SIZE = (canvas.width - PADDING * 2) / (BOARD_SIZE - 1);
const PIECE_RADIUS = CELL_SIZE * 0.43;

function boardToPixel(row, col) {
  return { x: PADDING + col * CELL_SIZE, y: PADDING + row * CELL_SIZE };
}

function pixelToBoard(px, py) {
  const col = Math.round((px - PADDING) / CELL_SIZE);
  const row = Math.round((py - PADDING) / CELL_SIZE);
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  return { row, col };
}

function render() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Wood background
  ctx.fillStyle = '#e8c982';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(180,140,80,${Math.random() * 0.05})`;
    ctx.lineWidth = Math.random() * 1.5 + 0.5;
    ctx.beginPath();
    const x = Math.random() * w, y = Math.random() * h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 25, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }

  // Grid
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = PADDING + i * CELL_SIZE;
    ctx.beginPath(); ctx.moveTo(x, PADDING); ctx.lineTo(x, PADDING + (BOARD_SIZE - 1) * CELL_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PADDING, x); ctx.lineTo(PADDING + (BOARD_SIZE - 1) * CELL_SIZE, x); ctx.stroke();
  }

  // Star points
  ctx.fillStyle = '#8b7355';
  for (const [r, c] of [[7,7],[3,3],[3,11],[11,3],[11,11]]) {
    const p = boardToPixel(r, c);
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Coordinates
  ctx.fillStyle = '#8b7355';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < BOARD_SIZE; i++) {
    ctx.fillText(String.fromCharCode(65 + i), PADDING + i * CELL_SIZE, 12);
    ctx.fillText(String(BOARD_SIZE - i), 12, PADDING + i * CELL_SIZE);
  }

  // Win line
  const winCells = game.gameOver && game.winner
    ? game.getWinLine(game.lastMove.row, game.lastMove.col, game.winner)
    : [];
  const winSet = new Set(winCells.map(c => `${c.row},${c.col}`));

  // Pieces
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (game.board[r][c] === EMPTY) continue;
      const p = boardToPixel(r, c);
      const isWin = winSet.has(`${r},${c}`);
      const isLast = game.lastMove && game.lastMove.row === r && game.lastMove.col === c;

      // Shadow
      ctx.beginPath(); ctx.arc(p.x + 2, p.y + 2, PIECE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

      // Piece
      ctx.beginPath(); ctx.arc(p.x, p.y, PIECE_RADIUS, 0, Math.PI * 2);
      if (game.board[r][c] === BLACK) {
        const g = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, PIECE_RADIUS);
        g.addColorStop(0, '#555'); g.addColorStop(1, '#111');
        ctx.fillStyle = g;
      } else {
        const g = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, PIECE_RADIUS);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#ccc');
        ctx.fillStyle = g;
      }
      ctx.fill();
      ctx.strokeStyle = game.board[r][c] === BLACK ? '#000' : '#999';
      ctx.lineWidth = 1; ctx.stroke();

      if (isWin) {
        ctx.beginPath(); ctx.arc(p.x, p.y, PIECE_RADIUS + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 3; ctx.stroke();
      }
      if (isLast) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = game.board[r][c] === BLACK ? '#ff6666' : '#ff4444';
        ctx.fill();
      }
    }
  }

  updateStatus();
  updateMoveHistory();
}

function updateStatus() {
  const indicator = document.getElementById('turnIndicator');
  const text = document.getElementById('turnText');

  if (game.gameOver) {
    if (game.winner === BLACK) text.textContent = '🏆 ' + (game.mode === 'pvc' ? '你赢了！' : '黑棋获胜！');
    else if (game.winner === WHITE) text.textContent = '🏆 ' + (game.mode === 'pvc' ? 'AI 获胜！' : '白棋获胜！');
    else text.textContent = '🤝 平局！';
    indicator.className = 'indicator ' + (game.winner === BLACK ? 'black' : game.winner === WHITE ? 'white' : 'black');
  } else if (game.aiThinking) {
    const t = game.difficulty === 'easy' ? '🌱简单' : game.difficulty === 'hard' ? '🔥困难' : '🌿中等';
    text.textContent = `🤖 ${t}AI思考中...`;
  } else if (game.mode === 'pvc' && game.currentPlayer === WHITE) {
    indicator.className = 'indicator white';
    text.textContent = '⏳ 等待AI...';
  } else {
    indicator.className = game.currentPlayer === BLACK ? 'indicator black' : 'indicator white';
    text.textContent = game.mode === 'pvc' ? '⚫ 你的回合' : (game.currentPlayer === BLACK ? '⚫ 黑棋落子' : '⚪ 白棋落子');
  }

  document.getElementById('blackScore').textContent = game.scores.black;
  document.getElementById('whiteScore').textContent = game.scores.white;
}

function updateMoveHistory() {
  const list = document.getElementById('moveList');
  list.innerHTML = '';
  if (game.history.length === 0) {
    list.innerHTML = '<span class="empty-hint">等待落子...</span>';
    return;
  }
  game.history.forEach((move, i) => {
    const tag = document.createElement('span');
    tag.className = `move-tag ${move.player === BLACK ? 'black-move' : 'white-move'}`;
    tag.innerHTML = `<span class="move-num">${i + 1}.</span>${String.fromCharCode(65 + move.col)}${BOARD_SIZE - move.row}`;
    list.appendChild(tag);
  });
  list.scrollTop = list.scrollHeight;
}

// ======================== Modal ========================

function showWinModal() {
  document.getElementById('winMessage').textContent =
    game.winner === BLACK ? (game.mode === 'pvc' ? '🎉 你赢了！' : '⚫ 黑棋获胜！')
    : game.winner === WHITE ? (game.mode === 'pvc' ? '🤖 AI 获胜！' : '⚪ 白棋获胜！')
    : '🤝 平局！';
  document.getElementById('winDetail').textContent = `共 ${game.moveCount} 手`;
  document.getElementById('winModal').classList.remove('hidden');
}

function hideWinModal() {
  document.getElementById('winModal').classList.add('hidden');
}

// ======================== Canvas Interaction ========================

canvas.addEventListener('click', (e) => {
  if (game.gameOver || game.aiThinking) return;
  if (game.mode === 'pvc' && game.currentPlayer !== game.humanPlayer) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const pos = pixelToBoard((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  if (!pos) return;

  const result = game.place(pos.row, pos.col);
  if (!result) return;

  render();

  if (game.gameOver) {
    setTimeout(showWinModal, 400);
  } else if (game.mode === 'pvc' && game.currentPlayer === game.aiPlayer) {
    // AI's turn - trigger with a tiny delay for UI to update
    setTimeout(() => game.aiMove(), 100);
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (game.gameOver || game.aiThinking) return;
  if (game.mode === 'pvc' && game.currentPlayer !== game.humanPlayer) {
    canvas.style.cursor = 'default';
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const pos = pixelToBoard((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  canvas.style.cursor = (pos && game.board[pos.row][pos.col] === EMPTY) ? 'pointer' : 'default';
});

// ======================== Button Handlers ========================

document.getElementById('modePVP').addEventListener('click', () => {
  hideWinModal(); game.reset(); game.mode = 'pvp';
  document.getElementById('modePVP').classList.add('active');
  document.getElementById('modePVC').classList.remove('active');
  document.getElementById('difficultySelector').classList.add('hidden');
  render();
});

document.getElementById('modePVC').addEventListener('click', () => {
  hideWinModal(); game.reset(); game.mode = 'pvc';
  game.difficulty = document.querySelector('.diff-btn.active')?.dataset?.diff || 'medium';
  document.getElementById('modePVC').classList.add('active');
  document.getElementById('modePVP').classList.remove('active');
  document.getElementById('difficultySelector').classList.remove('hidden');
  render();
});

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (game.mode === 'pvc') game.difficulty = btn.dataset.diff;
  });
});

document.getElementById('restartBtn').addEventListener('click', () => {
  hideWinModal(); game.reset(); render();
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
  hideWinModal(); game.reset(); render();
});

document.getElementById('undoBtn').addEventListener('click', () => {
  if (game.gameOver) return;
  game.undo(); render();
});

// BGM Toggle
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.createElement('button');
  btn.id = 'bgmBtn';
  btn.className = 'action-btn';
  btn.innerHTML = '🎵 BGM Off';
  btn.addEventListener('click', () => {
    const on = bgm.toggle();
    btn.innerHTML = on ? '🎵 BGM On' : '🎵 BGM Off';
  });
  document.querySelector('.sidebar').insertBefore(btn, document.querySelector('.move-history'));
});

// ======================== Init ========================

render();
