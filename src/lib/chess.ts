import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { GameSnapshot, Difficulty } from '../types';

const pieceValues: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export const createInitialSnapshot = (): GameSnapshot => {
  const chess = new Chess();
  return buildSnapshot(chess);
};

export const buildSnapshot = (chess: Chess, override?: Partial<GameSnapshot>): GameSnapshot => {
  const fen = chess.fen();
  const history = chess.history();
  const status = getStatus(chess);
  const captured = getCapturedPieces(chess.history({ verbose: true }));
  return {
    fen,
    pgn: chess.pgn(),
    history,
    fenHistory: override?.fenHistory ?? [fen],
    turn: chess.turn() as 'w' | 'b',
    status,
    isCheck: chess.isCheck(),
    isGameOver: chess.isGameOver(),
    lastMove: history.at(-1),
    winner: chess.isCheckmate() ? (chess.turn() === 'w' ? 'b' : 'w') : chess.isDraw() ? 'draw' : undefined,
    capturedWhite: captured.white,
    capturedBlack: captured.black,
    ...override,
  };
};

export const applyMove = (fen: string, move: string | Move): GameSnapshot | null => {
  const chess = new Chess(fen);
  let appliedMove: Move | null = null;
  try {
    appliedMove = typeof move === 'string' ? chess.move(move) : chess.move(move);
  } catch {
    return null;
  }
  if (!appliedMove) return null;
  return buildSnapshot(chess, {
    fenHistory: [fen, chess.fen()],
  });
};

export const undoMove = (snapshot: GameSnapshot): GameSnapshot => {
  const history = [...snapshot.fenHistory];
  if (history.length <= 1) return snapshot;
  history.pop();
  const chess = new Chess(history.at(-1) ?? snapshot.fen);
  return buildSnapshot(chess, {
    fenHistory: history,
  });
};

export const redoMove = (snapshot: GameSnapshot): GameSnapshot => {
  const history = [...snapshot.fenHistory];
  if (history.length <= 1) return snapshot;
  const nextFen = history.at(-1) ?? snapshot.fen;
  const chess = new Chess(nextFen);
  return buildSnapshot(chess, {
    fenHistory: history,
  });
};

export const getLegalMoves = (fen: string): string[] => {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true }).map((m) => `${m.from}${m.to}${m.promotion ?? ''}`);
};

export const importFen = (fen: string): GameSnapshot | null => {
  try {
    const chess = new Chess(fen);
    return buildSnapshot(chess);
  } catch {
    return null;
  }
};

export const getCapturedPieces = (moves: Move[]): { white: string[]; black: string[] } => {
  const capturedWhite: string[] = [];
  const capturedBlack: string[] = [];

  moves.forEach((move) => {
    if (!move.captured) return;
    if (move.color === 'w') {
      capturedBlack.push(getPieceSymbol(move.captured));
    } else {
      capturedWhite.push(getPieceSymbol(move.captured.toUpperCase()));
    }
  });

  return { white: capturedWhite, black: capturedBlack };
};

export const getPieceSymbol = (piece: string | null): string => {
  if (!piece) return '';

  const mapping: Record<string, string> = {
    P: '♙',
    N: '♘',
    B: '♗',
    R: '♖',
    Q: '♕',
    K: '♔',
    p: '♟',
    n: '♞',
    b: '♝',
    r: '♜',
    q: '♛',
    k: '♚',
  };

  return mapping[piece] ?? '';
};

export const getPieceColor = (piece: string | null): 'white' | 'black' => {
  if (!piece) return 'white';
  return piece === piece.toUpperCase() ? 'white' : 'black';
};

export const getAiMove = (fen: string, difficulty: Difficulty): string | null => {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  const weights = { beginner: 1, easy: 2, medium: 3, hard: 4, expert: 5, master: 6 };
  const depth = weights[difficulty];
  const scoredMoves = moves.map((move) => {
    const next = new Chess(fen);
    next.move(move);
    const score = evaluateBoard(next.fen(), next.turn() === 'w' ? 'b' : 'w', depth);
    return { move, score };
  });
  scoredMoves.sort((a, b) => b.score - a.score);
  const bestMove = scoredMoves[0]?.move;
  if (!bestMove) return null;
  return `${bestMove.from}${bestMove.to}${bestMove.promotion ?? ''}`;
};

function evaluateBoard(fen: string, side: 'w' | 'b', depth: number): number {
  const chess = new Chess(fen);
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) return side === 'w' ? -100000 : 100000;
    return 0;
  }
  const board = chess.board();
  let score = 0;
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      const value = pieceValues[cell.type];
      score += cell.color === 'w' ? value : -value;
    }
  }
  if (depth > 1) {
    const nextMoves = chess.moves({ verbose: true });
    if (nextMoves.length) {
      const next = nextMoves[0];
      const child = new Chess(fen);
      child.move(next);
      score += evaluateBoard(child.fen(), side, depth - 1) * 0.1;
    }
  }
  return score;
}

function getStatus(chess: Chess): GameSnapshot['status'] {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isThreefoldRepetition()) return 'threefold';
  if (chess.isInsufficientMaterial()) return 'insufficient-material';
  if (chess.isDraw()) return 'draw';
  return 'ongoing';
}
