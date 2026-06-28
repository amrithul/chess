import React from 'react';
import { useAppStore } from '../store/useAppStore';

const Panel: React.FC = () => {
  const theme = useAppStore((s) => s.theme);
  const settings = useAppStore((s) => s.settings);
  const snapshot = useAppStore((s) => s.snapshot);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const reset = useAppStore((s) => s.reset);
  const boardTheme = useAppStore((s) => s.boardTheme);
  const setBoardTheme = useAppStore((s) => s.setBoardTheme);

  const moveCount = snapshot.history?.length ?? 0;

  return (
    <div className="panel" style={{ background: `linear-gradient(145deg, ${theme === 'dark' ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.75)'}, ${theme === 'dark' ? 'rgba(6,10,21,0.95)' : 'rgba(245,245,255,0.95)'})` }}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Game Panel</p>
          <h2>{settings.username}</h2>
        </div>
        <div className={`pill ${snapshot.isCheck ? 'check-badge' : ''}`}>
          {snapshot.isCheck ? '⚠ CHECK' : snapshot.turn === 'w' ? 'White' : 'Black'}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Status</span>
          <strong>{snapshot.status}</strong>
        </div>
        <div className="stat-card">
          <span>Move</span>
          <strong>#{moveCount}</strong>
        </div>
      </div>

      <div className="captured-grid">
        <div className="stat-card captured-card">
          <span>White pieces taken</span>
          <div className="captured-list">
            {snapshot.capturedWhite.length ? snapshot.capturedWhite.map((piece, index) => (
              <span key={`white-${index}`} className="captured-piece captured-piece-white">{piece}</span>
            )) : <span className="captured-empty">None</span>}
          </div>
        </div>
        <div className="stat-card captured-card">
          <span>Black pieces taken</span>
          <div className="captured-list">
            {snapshot.capturedBlack.length ? snapshot.capturedBlack.map((piece, index) => (
              <span key={`black-${index}`} className="captured-piece captured-piece-black">{piece}</span>
            )) : <span className="captured-empty">None</span>}
          </div>
        </div>
      </div>

      <div className="controls-row">
        <button className="ghost-btn" onClick={undo}>↩ Undo</button>
        <button className="ghost-btn" onClick={redo}>↪ Redo</button>
        <button className="action-btn" onClick={reset}>⟳ Restart</button>
      </div>

      <details className="settings-details">
        <summary>⚙️ Settings</summary>
        <div className="field">
          <label>Board Theme</label>
          <select value={boardTheme} onChange={(e) => setBoardTheme(e.target.value as any)}>
            <option value="classic">Classic</option>
            <option value="wood">Wood</option>
            <option value="marble">Marble</option>
            <option value="tournament">Tournament</option>
            <option value="neon">Neon</option>
          </select>
        </div>
      </details>
    </div>
  );
};

export default Panel;
