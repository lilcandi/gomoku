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
    this.scores = { black: 0, white: 0 };
    this.aiThinking = false;
    this.moveCount = 0;
    this.lastMove = null;
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

    // Check win
    if (this.checkWin(row, col, this.currentPlayer)) {
      this.gameOver = true;
      this.winner = this.currentPlayer;
      if (this.currentPlayer === BLACK) this.scores.black++;
      else this.scores.white++;
      return true;
    }

    // Check draw
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
    
    // In PVC mode, undo two moves (player + AI)
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
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
      let count = 1;
      // Positive direction
      for (let i = 1; i < 5; i++) {
        const r = row + dx * i, c = col + dy * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== player) break;
        count++;
      }
      // Negative direction
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
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
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

  // ==================== AI (Simple Scoring Strategy) ====================
  aiMove() {
    if (this.gameOver || this.currentPlayer !== WHITE) return;
    this.aiThinking = true;

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const startTime = performance.now();
      
      // Evaluate all empty positions with a scoring system
      let bestScore = -1;
      let candidates = [];
      
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (this.board[r][c] !== EMPTY) continue;
          
          // Only consider positions near existing stones
          if (!this.hasNeighbor(r, c, 2)) continue;
          
          const score = this.evaluatePosition(r, c, WHITE) * 1.1 + this.evaluatePosition(r, c, BLACK);
          
          if (score > bestScore) {
            bestScore = score;
            candidates = [{ row: r, col: c }];
          } else if (score === bestScore) {
            candidates.push({ row: r, col: c });
          }
        }
      }

      // If no candidate found (empty board or first move), play center or near center
      if (candidates.length === 0) {
        const center = Math.floor(BOARD_SIZE / 2);
        candidates = [{ row: center, col: center }];
      }

      // Pick randomly from best candidates
      const move = candidates[Math.floor(Math.random() * candidates.length)];
      
      const elapsed = performance.now() - startTime;
      const delay = Math.max(0, 300 - elapsed); // Minimum 300ms for UX
      
      setTimeout(() => {
        this.place(move.row, move.col);
        this.aiThinking = false;
        render();
      }, delay);
    }, 50);
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

  evaluatePosition(row, col, player) {
    let totalScore = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    
    for (const [dx, dy] of directions) {
      let count = 1;
      let openEnds = 0;
      
      // Positive direction
      let blocked = false;
      for (let i = 1; i <= 4; i++) {
        const r = row + dx * i, c = col + dy * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) { blocked = true; break; }
        if (this.board[r][c] === player) count++;
        else if (this.board[r][c] === EMPTY) { openEnds++; break; }
        else { blocked = true; break; }
      }
      if (!blocked && count < 5) {
        const r = row + dx * (count > 0 ? count : 1);
        const c = col + dy * (count > 0 ? count : 1);
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && this.board[r][c] === EMPTY) {
          openEnds++;
        }
      }
      
      // Negative direction
      blocked = false;
      for (let i = 1; i <= 4; i++) {
        const r = row - dx * i, c = col - dy * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) { blocked = true; break; }
        if (this.board[r][c] === player) count++;
        else if (this.board[r][c] === EMPTY) { openEnds++; break; }
        else { blocked = true; break; }
      }
      if (!blocked && count < 5) {
        const r = row - dx * (count > 0 ? count : 1);
        const c = col - dy * (count > 0 ? count : 1);
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && this.board[r][c] === EMPTY) {
          openEnds++;
        }
      }
      
      // Score this direction
      if (count >= 5) totalScore += 100000;
      else if (count === 4) {
        if (openEnds === 2) totalScore += 10000;
        else if (openEnds === 1) totalScore += 5000;
      } else if (count === 3) {
        if (openEnds === 2) totalScore += 1000;
        else if (openEnds === 1) totalScore += 100;
      } else if (count === 2) {
        if (openEnds === 2) totalScore += 50;
        else if (openEnds === 1) totalScore += 10;
      } else if (count === 1) {
        if (openEnds === 2) totalScore += 3;
        else if (openEnds === 1) totalScore += 1;
      }
    }
    
    return totalScore;
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
  return {
    x: PADDING + col * CELL_SIZE,
    y: PADDING + row * CELL_SIZE
  };
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

  // Background
  ctx.fillStyle = '#e8c982';
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = PADDING + i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, PADDING);
    ctx.lineTo(x, PADDING + (BOARD_SIZE - 1) * CELL_SIZE);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(PADDING, x);
    ctx.lineTo(PADDING + (BOARD_SIZE - 1) * CELL_SIZE, x);
    ctx.stroke();
  }

  // Star points (天元 + 星位)
  const starPoints = [[7,7], [3,3], [3,11], [11,3], [11,11]];
  ctx.fillStyle = '#8b7355';
  for (const [r, c] of starPoints) {
    const pos = boardToPixel(r, c);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Coordinate labels
  ctx.fillStyle = '#8b7355';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < BOARD_SIZE; i++) {
    // Top letters
    ctx.fillText(String.fromCharCode(65 + i), PADDING + i * CELL_SIZE, 12);
    // Left numbers
    ctx.fillText(String(BOARD_SIZE - i), 12, PADDING + i * CELL_SIZE);
  }

  // Pieces
  const winCells = game.gameOver && game.winner 
    ? game.getWinLine(game.lastMove.row, game.lastMove.col, game.winner) 
    : [];
  const winSet = new Set(winCells.map(c => `${c.row},${c.col}`));

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (game.board[r][c] === EMPTY) continue;
      
      const pos = boardToPixel(r, c);
      const isWin = winSet.has(`${r},${c}`);
      const isLast = game.lastMove && game.lastMove.row === r && game.lastMove.col === c;
      
      // Shadow
      ctx.beginPath();
      ctx.arc(pos.x + 2, pos.y + 2, PIECE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // Piece
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, PIECE_RADIUS, 0, Math.PI * 2);
      
      if (game.board[r][c] === BLACK) {
        const gradient = ctx.createRadialGradient(pos.x - 3, pos.y - 3, 1, pos.x, pos.y, PIECE_RADIUS);
        gradient.addColorStop(0, '#555');
        gradient.addColorStop(1, '#111');
        ctx.fillStyle = gradient;
      } else {
        const gradient = ctx.createRadialGradient(pos.x - 3, pos.y - 3, 1, pos.x, pos.y, PIECE_RADIUS);
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, '#ccc');
        ctx.fillStyle = gradient;
      }
      ctx.fill();
      ctx.strokeStyle = game.board[r][c] === BLACK ? '#000' : '#999';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Win highlight
      if (isWin) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, PIECE_RADIUS + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Last move marker
      if (isLast) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = game.board[r][c] === BLACK ? '#ff6666' : '#ff4444';
        ctx.fill();
      }
    }
  }

  // Update UI
  updateStatus();
  updateMoveHistory();
}

function updateStatus() {
  const indicator = document.getElementById('turnIndicator');
  const text = document.getElementById('turnText');

  if (game.gameOver) {
    if (game.winner === BLACK) {
      indicator.className = 'indicator black';
      text.textContent = '🏆 黑棋获胜！';
    } else if (game.winner === WHITE) {
      indicator.className = 'indicator white';
      text.textContent = '🏆 白棋获胜！';
    } else {
      text.textContent = '🤝 平局！';
    }
  } else if (game.aiThinking) {
    text.textContent = '🤖 AI思考中...';
  } else {
    if (game.currentPlayer === BLACK) {
      indicator.className = 'indicator black';
      text.textContent = game.mode === 'pvc' ? '⚫ 你的回合' : '⚫ 黑棋落子';
    } else {
      indicator.className = 'indicator white';
      text.textContent = game.mode === 'pvc' ? '🤖 AI回合...' : '⚪ 白棋落子';
    }
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
    const colLabel = String.fromCharCode(65 + move.col);
    const rowLabel = BOARD_SIZE - move.row;
    tag.innerHTML = `<span class="move-num">${i + 1}.</span>${colLabel}${rowLabel}`;
    list.appendChild(tag);
  });

  list.scrollTop = list.scrollHeight;
}

function showWinModal() {
  const modal = document.getElementById('winModal');
  const msg = document.getElementById('winMessage');
  const detail = document.getElementById('winDetail');

  if (game.winner === BLACK) {
    msg.textContent = '⚫ 黑棋获胜！';
  } else if (game.winner === WHITE) {
    msg.textContent = '⚪ 白棋获胜！';
  } else {
    msg.textContent = '🤝 平局！';
  }
  detail.textContent = `共 ${game.moveCount} 手`;
  modal.classList.remove('hidden');
}

function hideWinModal() {
  document.getElementById('winModal').classList.add('hidden');
}

// ======================== Canvas Click Handler ========================

canvas.addEventListener('click', (e) => {
  if (game.gameOver || game.aiThinking) return;
  if (game.mode === 'pvc' && game.currentPlayer === WHITE) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const pos = pixelToBoard(px, py);
  
  if (!pos) return;

  const result = game.place(pos.row, pos.col);
  if (!result) return;

  render();

  if (game.gameOver) {
    setTimeout(showWinModal, 400);
  } else if (game.mode === 'pvc' && game.currentPlayer === WHITE) {
    game.aiMove();
  }
});

// ======================== Button Handlers ========================

document.getElementById('restartBtn').addEventListener('click', () => {
  hideWinModal();
  game.reset();
  render();
  if (game.mode === 'pvc') game.aiMove();
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
  hideWinModal();
  game.reset();
  render();
  if (game.mode === 'pvc') game.aiMove();
});

document.getElementById('undoBtn').addEventListener('click', () => {
  if (game.gameOver) return;
  game.undo();
  render();
});

document.getElementById('modePVP').addEventListener('click', () => {
  hideWinModal();
  game.reset();
  game.mode = 'pvp';
  document.getElementById('modePVP').classList.add('active');
  document.getElementById('modePVC').classList.remove('active');
  render();
});

document.getElementById('modePVC').addEventListener('click', () => {
  hideWinModal();
  game.reset();
  game.mode = 'pvc';
  document.getElementById('modePVC').classList.add('active');
  document.getElementById('modePVP').classList.remove('active');
  render();
  if (game.currentPlayer === BLACK) {
    // Player goes first
  }
});

// ======================== Init ========================

render();
