export type AppMode = 'home' | 'local' | 'ai' | 'online';
export type ThemeName = 'dark' | 'light' | 'wood' | 'marble' | 'tournament' | 'neon';
export type BoardThemeName = 'classic' | 'wood' | 'marble' | 'tournament' | 'neon';
export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' | 'master';
export type MoveSpeed = 'slow' | 'normal' | 'fast';

export interface PlayerSettings {
  username: string;
  avatar: string;
  pieceTheme: 'classic' | 'neo' | 'wood';
  boardTheme: BoardThemeName;
  moveSounds: boolean;
  boardFlip: boolean;
  animationSpeed: MoveSpeed;
  clock: number | 'unlimited';
  autoQueen: boolean;
  showLegalMoves: boolean;
  aiDifficulty: Difficulty;
}

export interface GameSnapshot {
  fen: string;
  pgn: string;
  history: string[];
  fenHistory: string[];
  turn: 'w' | 'b';
  status: 'ongoing' | 'checkmate' | 'stalemate' | 'draw' | 'threefold' | 'fifty-move' | 'insufficient-material';
  isCheck: boolean;
  isGameOver: boolean;
  lastMove?: string;
  winner?: 'w' | 'b' | 'draw';
  capturedWhite: string[];
  capturedBlack: string[];
}

export interface RoomSummary {
  id: string;
  code: string;
  players: string[];
  spectatorCount: number;
  status: 'waiting' | 'playing' | 'finished';
}
