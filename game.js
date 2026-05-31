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
    this.mode = 'pvp';
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

  place(row, col) {
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

    this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
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

  aiEasy() {
    const candidates = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== EMPTY || !this.hasNeighbor(r, c, 2)) continue;
        const off = this.evaluatePosition(r, c, WHITE);
        const def = this.evaluatePosition(r, c, BLACK);
        let s = Math.max(off, def) + Math.random() * 3000;
        s += (7 - Math.abs(r - 7)) * 2 + (7 - Math.abs(c - 7)) * 2;
        candidates.push({ r, c, s });
      }
    }
    if (candidates.length === 0) return { r: 7, c: 7 };
    candidates.sort((a, b) => b.s - a.s);
    if (Math.random() < 0.3 && candidates.length > 2) 
      return candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
    return candidates[0];
  }

  aiMedium() {
    let bestS = -1;
    const best = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== EMPTY || !this.hasNeighbor(r, c, 2)) continue;
        const off = this.evaluatePosition(r, c, WHITE);
        const def = this.evaluatePosition(r, c, BLACK);
        let s = off >= 100000 ? off * 1.5 : def >= 100000 ? def * 1.3 : off * 1.1 + def;
        s += (7 - Math.abs(r - 7)) * 5 + (7 - Math.abs(c - 7)) * 5;
        if (s > bestS) { bestS = s; best.length = 0; best.push({ r, c }); }
        else if (s === bestS) best.push({ r, c });
      }
    }
    if (best.length === 0) return { r: 7, c: 7 };
    return best[Math.floor(Math.random() * best.length)];
  }

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

  triggerAI() {
    if (this.gameOver || this.aiThinking) return;
    if (this.currentPlayer !== this.aiPlayer) return;
    
    this.aiThinking = true;
    render();

    setTimeout(() => {
      let move;
      try {
        if (this.difficulty === 'easy') move = this.aiEasy();
        else if (this.difficulty === 'hard') move = this.aiHard();
        else move = this.aiMedium();
      } catch(e) { console.error('[AI error]', e); this.aiThinking = false; render(); return; }

      if (!move) { this.aiThinking = false; render(); return; }

      setTimeout(() => {
        this.board[move.r][move.c] = WHITE;
        this.history.push({ row: move.r, col: move.c, player: WHITE });
        this.lastMove = { row: move.r, col: move.c };
        this.moveCount++;

        if (this.checkWin(move.r, move.c, WHITE)) {
          this.gameOver = true;
          this.winner = WHITE;
          this.scores.white++;
        }
        
        this.currentPlayer = BLACK;
        this.aiThinking = false;
        render();
        
        if (this.gameOver) setTimeout(showWinModal, 400);
      }, this.difficulty === 'easy' ? 100 : this.difficulty === 'hard' ? 400 : 200);
    }, 50);
  }
}

// ======================== Rendering ========================

const canvas = document.getElementById('boardCanvas');
const ctx = canvas.getContext('2d');
const game = new GomokuGame();

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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e8c982';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = PADDING + i * CELL_SIZE;
    ctx.beginPath(); ctx.moveTo(x, PADDING); ctx.lineTo(x, PADDING + (BOARD_SIZE - 1) * CELL_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PADDING, x); ctx.lineTo(PADDING + (BOARD_SIZE - 1) * CELL_SIZE, x); ctx.stroke();
  }

  ctx.fillStyle = '#8b7355';
  for (const [r, c] of [[7,7],[3,3],[3,11],[11,3],[11,11]]) {
    const p = boardToPixel(r, c);
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < BOARD_SIZE; i++) {
    ctx.fillText(String.fromCharCode(65 + i), PADDING + i * CELL_SIZE, 12);
    ctx.fillText(String(BOARD_SIZE - i), 12, PADDING + i * CELL_SIZE);
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (game.board[r][c] === EMPTY) continue;
      const p = boardToPixel(r, c);
      ctx.beginPath(); ctx.arc(p.x + 2, p.y + 2, PIECE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

      ctx.beginPath(); ctx.arc(p.x, p.y, PIECE_RADIUS, 0, Math.PI * 2);
      if (game.board[r][c] === BLACK) {
        const g = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, PIECE_RADIUS);
        g.addColorStop(0, '#555'); g.addColorStop(1, '#111'); ctx.fillStyle = g;
      } else {
        const g = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, PIECE_RADIUS);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#ccc'); ctx.fillStyle = g;
      }
      ctx.fill();
      ctx.strokeStyle = game.board[r][c] === BLACK ? '#000' : '#999'; ctx.stroke();

      if (game.lastMove && game.lastMove.row === r && game.lastMove.col === c) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4444'; ctx.fill();
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
    indicator.className = 'indicator ' + (game.winner === BLACK ? 'black' : 'white');
    text.textContent = game.winner === BLACK ? '🏆 黑棋获胜！' : game.winner === WHITE ? '🏆 白棋获胜！' : '🤝 平局！';
  } else if (game.aiThinking) {
    indicator.className = 'indicator white';
    text.textContent = '🤖 AI思考中...';
  } else {
    indicator.className = game.currentPlayer === BLACK ? 'indicator black' : 'indicator white';
    text.textContent = game.mode === 'pvc' && game.currentPlayer === BLACK ? '⚫ 你的回合' : 
                       game.currentPlayer === BLACK ? '⚫ 黑棋落子' : '⚪ 白棋落子';
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
    tag.innerHTML = `${i + 1}. ${String.fromCharCode(65 + move.col)}${BOARD_SIZE - move.row}`;
    list.appendChild(tag);
  });
  list.scrollTop = list.scrollHeight;
}

function showWinModal() {
  document.getElementById('winMessage').textContent = 
    game.winner === BLACK ? '🏆 黑棋获胜！' : game.winner === WHITE ? '🏆 白棋获胜！' : '🤝 平局！';
  document.getElementById('winDetail').textContent = `共 ${game.moveCount} 手`;
  document.getElementById('winModal').classList.remove('hidden');
}

function hideWinModal() {
  document.getElementById('winModal').classList.add('hidden');
}

// ======================== Canvas Click ========================

canvas.addEventListener('click', (e) => {
  if (game.gameOver || game.aiThinking) return;
  if (game.mode === 'pvc' && game.currentPlayer === WHITE) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const pos = pixelToBoard((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  
  if (!pos) return;

  if (!game.place(pos.row, pos.col)) return;

  render();

  if (game.gameOver) {
    setTimeout(showWinModal, 400);
  } else if (game.mode === 'pvc') {
    game.triggerAI();
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (game.gameOver || game.aiThinking) return;
  if (game.mode === 'pvc' && game.currentPlayer === WHITE) {
    canvas.style.cursor = 'default'; return;
  }
  const rect = canvas.getBoundingClientRect();
  const pos = pixelToBoard((e.clientX - rect.left) * canvas.width / rect.width, 
                           (e.clientY - rect.top) * canvas.height / rect.height);
  canvas.style.cursor = (pos && game.board[pos.row][pos.col] === EMPTY) ? 'pointer' : 'default';
});

// ======================== Buttons ========================

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
    game.difficulty = btn.dataset.diff;
    updateStatus();
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

// BGM Button
document.getElementById('bgmBtnSide')?.addEventListener('click', function() {
  this.textContent = this.textContent.includes('关') ? '🎵 音乐开' : '🎵 音乐关';
});

// Init
render();