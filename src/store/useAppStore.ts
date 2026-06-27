import { create } from 'zustand';
import { createInitialSnapshot, applyMove as applyChessMove, undoMove, redoMove as redoChessMove } from '../lib/chess';
import type { BoardThemeName, GameSnapshot, PlayerSettings, ThemeName } from '../types';

interface AppStore {
  mode: 'home' | 'local' | 'ai' | 'online';
  theme: ThemeName;
  boardTheme: BoardThemeName;
  settings: PlayerSettings;
  snapshot: GameSnapshot;
  setMode: (mode: 'home' | 'local' | 'ai' | 'online') => void;
  setTheme: (theme: ThemeName) => void;
  setBoardTheme: (theme: BoardThemeName) => void;
  updateSettings: (settings: Partial<PlayerSettings>) => void;
  applyMove: (move: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  importFen: (fen: string) => void;
  importPgn: (pgn: string) => void;
}

const defaultSettings: PlayerSettings = {
  username: 'Grandmaster',
  avatar: '♞',
  pieceTheme: 'classic',
  boardTheme: 'classic',
  moveSounds: true,
  boardFlip: false,
  animationSpeed: 'normal',
  clock: 10,
  autoQueen: true,
  showLegalMoves: true,
  aiDifficulty: 'medium',
};

export const useAppStore = create<AppStore>((set) => ({
  mode: 'home',
  theme: 'dark',
  boardTheme: 'classic',
  settings: defaultSettings,
  snapshot: createInitialSnapshot(),
  setMode: (mode) => set({ mode }),
  setTheme: (theme) => set({ theme }),
  setBoardTheme: (boardTheme) => set({ boardTheme }),
  updateSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
  applyMove: (move) => set((state) => {
    const next = applyChessMove(state.snapshot.fen, move);
    if (!next) return state;
    return { snapshot: next };
  }),
  undo: () => set((state) => ({ snapshot: undoMove(state.snapshot) })),
  redo: () => set((state) => ({ snapshot: redoChessMove(state.snapshot) })),
  reset: () => set({ snapshot: createInitialSnapshot() }),
  importFen: (fen) => set((state) => ({ snapshot: { ...state.snapshot, fen } })),
  importPgn: (pgn) => set((state) => ({ snapshot: { ...state.snapshot, pgn } })),
}));
