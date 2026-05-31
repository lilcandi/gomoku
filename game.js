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
    this.difficulty = 'medium'; // 'easy', 'medium', 'hard'
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
        const r = row - dx * i, c = col + dy * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== player) break;
        cells.push({ row: r, col: c });
      }
      if (cells.length >= 5) return cells;
    }
    return [];
  }

  // ==================== AI with Three Difficulty Levels ====================

  /**
   * Pattern scoring weights for AI evaluation.
   * Higher weight = more important to play/block.
   */
  static PATTERNS = {
    FIVE:      { score: 1000000, label: '五连' },
    OPEN_FOUR: { score: 100000,  label: '活四' },
    HALF_FOUR: { score: 10000,   label: '冲四' },
    OPEN_THREE:{ score: 5000,    label: '活三' },
    HALF_THREE:{ score: 500,     label: '眠三' },
    OPEN_TWO:  { score: 200,     label: '活二' },
    HALF_TWO:  { score: 50,      label: '眠二' },
  };

  /**
   * Position weight map - center is valued higher
   */
  static POSITION_WEIGHT = (() => {
    const w = [];
    const center = Math.floor(BOARD_SIZE / 2);
    for (let r = 0; r < BOARD_SIZE; r++) {
      w[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        const dr = r - center, dc = c - center;
        const dist = Math.sqrt(dr * dr + dc * dc);
        // Center (dist=0) gets 10, edges get ~1
        w[r][c] = Math.round(Math.max(1, 10 - dist * 0.8));
      }
    }
    return w;
  })();

  /**
   * Check if a position has a neighboring stone within distance.
   */
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

  /**
   * Analyze a single position in one direction.
   * Returns { count, openEnds, captures } for a given player.
   */
  analyzeDirection(row, col, dx, dy, player) {
    let count = 1;
    let openEnds = 0;
    let captures = [];

    // Positive direction
    let pBlocked = false;
    for (let i = 1; i <= 4; i++) {
      const r = row + dx * i, c = col + dy * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) { pBlocked = true; break; }
      if (this.board[r][c] === player) count++;
      else if (this.board[r][c] === EMPTY) { openEnds++; captures.push({ row: r, col: c }); break; }
      else { pBlocked = true; break; }
    }

    // Negative direction
    let nBlocked = false;
    for (let i = 1; i <= 4; i++) {
      const r = row - dx * i, c = col - dy * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) { nBlocked = true; break; }
      if (this.board[r][c] === player) count++;
      else if (this.board[r][c] === EMPTY) { openEnds++; captures.push({ row: r, col: c }); break; }
      else { nBlocked = true; break; }
    }

    return { count, openEnds, blocked: (pBlocked ? 1 : 0) + (nBlocked ? 1 : 0) };
  }

  /**
   * Score a single position for a given player.
   */
  evaluatePosition(row, col, player) {
    let score = 0;
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

    for (const [dx, dy] of directions) {
      const { count, openEnds, blocked } = this.analyzeDirection(row, col, dx, dy, player);

      if (count >= 5) score += 1000000;
      else if (count === 4) {
        if (openEnds === 2) score += 100000;  // Open four - almost unstoppable
        else if (openEnds === 1) score += 10000;  // Half four
      } else if (count === 3) {
        if (openEnds === 2) score += 5000;   // Open three
        else if (openEnds === 1) score += 500;   // Half three
      } else if (count === 2) {
        if (openEnds === 2) score += 200;    // Open two
        else if (openEnds === 1) score += 50;    // Half two
      } else if (count === 1) {
        if (openEnds === 2) score += 10;
        else if (openEnds === 1) score += 3;
      }
    }

    return score;
  }

  /**
   * Easy AI: Simple scoring with random noise. Makes mistakes.
   */
  aiEasy() {
    const candidates = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== EMPTY) continue;
        if (!this.hasNeighbor(r, c, 2)) continue;

        const offense = this.evaluatePosition(r, c, this.aiPlayer);
        const defense = this.evaluatePosition(r, c, this.humanPlayer);
        let score = Math.max(offense, defense);

        // Add random noise (30% randomness)
        score += Math.random() * 3000;
        // Slight center preference
        score += GomokuGame.POSITION_WEIGHT[r][c] * 2;

        candidates.push({ row: r, col: c, score });
      }
    }

    // If no candidates, place near center
    if (candidates.length === 0) {
      const center = Math.floor(BOARD_SIZE / 2);
      return { row: center, col: center };
    }

    // 30% chance to make a sub-optimal move (not the best)
    if (Math.random() < 0.3 && candidates.length > 3) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  /**
   * Medium AI: Good scoring, blocks threats, weight-balanced.
   */
  aiMedium() {
    let bestScore = -1;
    let candidates = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== EMPTY) continue;
        if (!this.hasNeighbor(r, c, 2)) continue;

        // Offense score (how good for AI)
        const offense = this.evaluatePosition(r, c, this.aiPlayer);
        // Defense score (how good for opponent - block these!)
        const defense = this.evaluatePosition(r, c, this.humanPlayer);

        // Weight: prioritize winning, then blocking, then position
        let score = 0;
        
        // If AI can win, play it
        if (offense >= 100000) score = offense * 1.5;
        // If opponent can win, block it (slightly lower priority than winning)
        else if (defense >= 100000) score = defense * 1.3;
        // Otherwise, balance offense and defense
        else score = offense * 1.1 + defense;
        
        // Position bonus
        score += GomokuGame.POSITION_WEIGHT[r][c] * 5;

        if (score > bestScore) {
          bestScore = score;
          candidates = [{ row: r, col: c }];
        } else if (score === bestScore) {
          candidates.push({ row: r, col: c });
        }
      }
    }

    if (candidates.length === 0) {
      const center = Math.floor(BOARD_SIZE / 2);
      return { row: center, col: center };
    }

    // If there are good threats, pick the best one deterministically
    if (bestScore >= 5000) {
      return candidates[0];
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Hard AI: Deep evaluation, threat detection, strongest play.
   */
  aiHard() {
    let bestScore = -Infinity;
    let bestMove = null;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== EMPTY) continue;
        if (!this.hasNeighbor(r, c, 2)) continue;

        // Comprehensive scoring
        const offense = this.evaluatePosition(r, c, this.aiPlayer);
        const defense = this.evaluatePosition(r, c, this.humanPlayer);

        let score = 0;

        // Priority 1: Win immediately
        if (offense >= 1000000) score = 10000000;
        // Priority 2: Block opponent's five
        else if (defense >= 1000000) score = 9000000;
        // Priority 3: Create open four (almost winning)
        else if (offense >= 100000) score = 800000 + offense;
        // Priority 4: Block opponent's open four
        else if (defense >= 100000) score = 700000 + defense;
        // Priority 5: Create open three / half four
        else if (offense >= 5000) score = 500000 + offense;
        // Priority 6: Block opponent's threats
        else if (defense >= 5000) score = 400000 + defense;
        // Priority 7: Balanced play
        else {
          // Look for positions that create multiple threats
          score = offense * 1.2 + defense * 1.0;
          
          // Bonus for positions with multiple directions of contribution
          const dirs = [[1,0],[0,1],[1,1],[1,-1]];
          let multiDirBonus = 0;
          for (const [dx, dy] of dirs) {
            const a = this.analyzeDirection(r, c, dx, dy, this.aiPlayer);
            const d = this.analyzeDirection(r, c, dx, dy, this.humanPlayer);
            if (a.count >= 3 && a.openEnds >= 1) multiDirBonus += 300;
            if (d.count >= 3 && d.openEnds >= 1) multiDirBonus += 200;
          }
          score += multiDirBonus;
        }

        // Position weight (center is strategic)
        score += GomokuGame.POSITION_WEIGHT[r][c] * 8;

        if (score > bestScore) {
          bestScore = score;
          bestMove = { row: r, col: c };
        }
      }
    }

    if (!bestMove) {
      const center = Math.floor(BOARD_SIZE / 2);
      bestMove = { row: center, col: center };
    }

    return bestMove;
  }

  /**
   * Main AI entry point - dispatches to difficulty-specific AI.
   */
  aiMove() {
    if (this.gameOver || this.currentPlayer !== this.aiPlayer) return;
    this.aiThinking = true;

    setTimeout(() => {
      const startTime = performance.now();
      
      let move;
      switch (this.difficulty) {
        case 'easy':
          move = this.aiEasy();
          break;
        case 'hard':
          move = this.aiHard();
          break;
        case 'medium':
        default:
          move = this.aiMedium();
          break;
      }

      const elapsed = performance.now() - startTime;
      // Different delays per difficulty for UX feel
      const minDelay = this.difficulty === 'easy' ? 200 : 
                       this.difficulty === 'medium' ? 400 : 600;
      const delay = Math.max(0, minDelay - elapsed);

      setTimeout(() => {
        this.place(move.row, move.col);
        this.aiThinking = false;
        render();
      }, delay);
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

  // Background (wood texture)
  ctx.fillStyle = '#e8c982';
  ctx.fillRect(0, 0, w, h);
  
  // Add subtle wood grain
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.strokeStyle = `rgba(180, 140, 80, ${Math.random() * 0.06})`;
    ctx.lineWidth = Math.random() * 2 + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }

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
    ctx.fillText(String.fromCharCode(65 + i), PADDING + i * CELL_SIZE, 12);
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

  // Hover effect
  if (!game.gameOver && !game.aiThinking) {
    // Show a subtle ghost piece on hover (implemented via mousemove)
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
    const thinkingText = game.difficulty === 'easy' ? '🤖 简单AI思考中...' :
                         game.difficulty === 'hard' ? '🔥 困难AI思考中...' :
                         '🤖 AI思考中...';
    text.textContent = thinkingText;
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
    msg.textContent = game.mode === 'pvc' ? '🎉 你赢了！' : '⚫ 黑棋获胜！';
  } else if (game.winner === WHITE) {
    msg.textContent = game.mode === 'pvc' ? '🤖 AI 获胜！' : '⚪ 白棋获胜！';
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

// Hover effect showing where the piece will be placed
canvas.addEventListener('mousemove', (e) => {
  if (game.gameOver || game.aiThinking) return;
  if (game.mode === 'pvc' && game.currentPlayer === WHITE) {
    canvas.style.cursor = 'default';
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const pos = pixelToBoard(px, py);

  if (pos && game.board[pos.row][pos.col] === EMPTY) {
    canvas.style.cursor = 'pointer';
    // Redraw without hover to keep it clean - actual hover preview would need
    // incremental rendering which is complex
  } else {
    canvas.style.cursor = 'default';
  }
});

// ======================== Button Handlers ========================

// Difficulty labels for display
const DIFF_LABELS = {
  easy: '🌱 简单',
  medium: '🌿 中等',
  hard: '🔥 困难'
};

document.getElementById('restartBtn').addEventListener('click', () => {
  hideWinModal();
  game.reset();
  render();
  if (game.mode === 'pvc' && game.currentPlayer === game.humanPlayer) {
    // Player goes first, nothing to do
  }
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
  hideWinModal();
  game.reset();
  render();
  if (game.mode === 'pvc') {
    // In PVC, AI goes second
  }
});

document.getElementById('undoBtn').addEventListener('click', () => {
  if (game.gameOver) return;
  game.undo();
  render();
});

// PVP mode
document.getElementById('modePVP').addEventListener('click', () => {
  hideWinModal();
  const wasPVC = game.mode === 'pvc';
  game.reset();
  game.mode = 'pvp';
  document.getElementById('modePVP').classList.add('active');
  document.getElementById('modePVC').classList.remove('active');
  document.getElementById('difficultySelector').classList.add('hidden');
  render();
});

// PVC mode
document.getElementById('modePVC').addEventListener('click', () => {
  hideWinModal();
  const wasPVP = game.mode === 'pvp';
  game.reset();
  game.mode = 'pvc';
  game.difficulty = document.querySelector('.diff-btn.active')?.dataset?.diff || 'medium';
  document.getElementById('modePVC').classList.add('active');
  document.getElementById('modePVP').classList.remove('active');
  document.getElementById('difficultySelector').classList.remove('hidden');
  render();
});

// Difficulty buttons
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if (game.mode === 'pvc') {
      game.difficulty = btn.dataset.diff;
      // Show visual feedback
      updateStatus();
    }
  });
});

// ======================== Init ========================

render();
