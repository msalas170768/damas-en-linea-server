'use strict';

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r <= 2) board[r][c] = { player: 'black', king: false };
        else if (r >= 5) board[r][c] = { player: 'red', king: false };
      }
    }
  }
  return board;
}

function cloneBoard(board) {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

// All capture moves for piece at (r, c). Both normal and king pieces capture in all 4 directions.
function getPieceCaptures(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const opp = piece.player === 'red' ? 'black' : 'red';
  const captures = [];

  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const mr = r + dr, mc = c + dc;
    const tr = r + 2 * dr, tc = c + 2 * dc;
    if (inBounds(mr, mc) && inBounds(tr, tc)) {
      if (board[mr][mc]?.player === opp && !board[tr][tc]) {
        captures.push({ to: [tr, tc], captured: [mr, mc] });
      }
    }
  }
  return captures;
}

// Simple (non-capture) moves. Normal pieces move forward only; kings move all 4 directions.
function getPieceSimpleMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];

  const dirs = piece.king
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : piece.player === 'red'
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]];

  return dirs
    .map(([dr, dc]) => [r + dr, c + dc])
    .filter(([nr, nc]) => inBounds(nr, nc) && !board[nr][nc]);
}

function playerHasAnyCapture(board, player) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.player === player && getPieceCaptures(board, r, c).length > 0) return true;
    }
  }
  return false;
}

// Returns { captures, moves } honoring mandatory-capture and multi-jump constraints.
function getValidActions(board, r, c, mandatoryPiece) {
  const piece = board[r][c];
  if (!piece) return { captures: [], moves: [] };
  const player = piece.player;

  if (mandatoryPiece) {
    if (mandatoryPiece[0] !== r || mandatoryPiece[1] !== c) return { captures: [], moves: [] };
    return { captures: getPieceCaptures(board, r, c), moves: [] };
  }

  const captures = getPieceCaptures(board, r, c);
  if (playerHasAnyCapture(board, player)) return { captures, moves: [] };
  return { captures: [], moves: getPieceSimpleMoves(board, r, c) };
}

// Applies move (fr,fc) → (tr,tc). Returns { board, capturedPos }.
function applyMove(board, fr, fc, tr, tc) {
  const newBoard = cloneBoard(board);
  const piece = { ...newBoard[fr][fc] };
  let capturedPos = null;

  if (Math.abs(tr - fr) === 2) {
    const cr = (fr + tr) / 2;
    const cc = (fc + tc) / 2;
    capturedPos = [cr, cc];
    newBoard[cr][cc] = null;
  }

  newBoard[fr][fc] = null;

  if (!piece.king) {
    if (piece.player === 'red' && tr === 0) piece.king = true;
    if (piece.player === 'black' && tr === 7) piece.king = true;
  }

  newBoard[tr][tc] = piece;
  return { board: newBoard, capturedPos };
}

// Returns the winning player color, or null if the game continues.
function getWinner(board, nextPlayer) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.player === nextPlayer) {
        if (
          getPieceCaptures(board, r, c).length > 0 ||
          getPieceSimpleMoves(board, r, c).length > 0
        ) return null;
      }
    }
  }
  return nextPlayer === 'red' ? 'black' : 'red';
}

module.exports = { createInitialBoard, getValidActions, applyMove, getWinner, getPieceCaptures };
