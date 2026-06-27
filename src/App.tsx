import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import Board from './components/Board';
import { exportFen, exportPgn, getAiMove, getLegalMoves, importFen as importFenState, importPgn as importPgnState } from './lib/chess';
import { useAppStore } from './store/useAppStore';
import type { Difficulty, RoomSummary } from './types';

const defaultProfile = {
  rating: 1842,
  games: 284,
  wins: 162,
  losses: 79,
  draws: 43,
  accuracy: 82,
};

const leaderboard = [
  { username: 'Alicia', rating: 2034, games: 318 },
  { username: 'RookMaster', rating: 1988, games: 294 },
  { username: 'Ambra', rating: 1934, games: 281 },
  { username: 'Theo', rating: 1890, games: 267 },
];

const App = () => {
  const navigate = useNavigate();
  const mode = useAppStore((state) => state.mode);
  const theme = useAppStore((state) => state.theme);
  const boardTheme = useAppStore((state) => state.boardTheme);
  const settings = useAppStore((state) => state.settings);
  const snapshot = useAppStore((state) => state.snapshot);
  const applyMove = useAppStore((state) => state.applyMove);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const reset = useAppStore((state) => state.reset);
  const setMode = useAppStore((state) => state.setMode);
  const setTheme = useAppStore((state) => state.setTheme);
  const setBoardTheme = useAppStore((state) => state.setBoardTheme);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const [roomCode, setRoomCode] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<RoomSummary | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null);
  const [joinPromptOpen, setJoinPromptOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [chatText, setChatText] = useState('');
  const [fenInput, setFenInput] = useState(snapshot.fen);
  const [pgnInput, setPgnInput] = useState(snapshot.pgn);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>('medium');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [gameStarted, setGameStarted] = useState(mode !== 'ai');

  const roomStatusLabel = !onlineRoom
    ? 'Create a room to start'
    : onlineRoom.players.length < 2
      ? 'Waiting for opponent...'
      : 'Match in progress';
  const playerTurnLabel = mode === 'online' && playerColor
    ? snapshot.turn === (playerColor === 'w' ? 'w' : 'b')
      ? 'Your turn'
      : "Opponent's turn"
    : roomStatusLabel;

  useEffect(() => {
    setFenInput(snapshot.fen);
    setPgnInput(snapshot.pgn);
  }, [snapshot.fen, snapshot.pgn]);

  useEffect(() => {
    setGameStarted(mode !== 'ai');
  }, [mode]);

  useEffect(() => {
    if (mode !== 'online') return;
    const client = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', { transports: ['websocket'] });
    client.on('connect', () => {
      setSocket(client);
    });
    client.on('room-created', (payload: { room: RoomSummary; playerColor: 'w' | 'b'; fen: string }) => {
      setOnlineRoom(payload.room);
      setPlayerColor(payload.playerColor);
      useAppStore.setState({ mode: 'online' });
      useAppStore.setState({ snapshot: { ...useAppStore.getState().snapshot, fen: payload.fen } });
    });
    client.on('room-joined', (payload: { room: RoomSummary; playerColor: 'w' | 'b'; fen: string }) => {
      setOnlineRoom(payload.room);
      setPlayerColor(payload.playerColor);
      useAppStore.setState({ mode: 'online' });
      useAppStore.setState({ snapshot: { ...useAppStore.getState().snapshot, fen: payload.fen } });
    });
    client.on('room-update', (payload: { room: RoomSummary }) => setOnlineRoom(payload.room));
    client.on('chat-message', (payload: { content: string }) => {
      setChatMessages((prev) => [...prev, payload.content]);
    });
    client.on('move-applied', (payload: { fen: string }) => {
      const next = importFenState(payload.fen);
      if (next) {
        const current = useAppStore.getState();
        useAppStore.setState({ snapshot: next });
        if (current.mode !== 'online') {
          useAppStore.setState({ mode: 'online' });
        }
      }
    });
    return () => {
      client.disconnect();
    };
  }, [mode]);

  const legalMoves = useMemo(() => getLegalMoves(snapshot.fen), [snapshot.fen]);

  const handleMove = (from: string, to: string) => {
    const move = `${from}${to}`;
    if (mode === 'online' && playerColor) {
      const currentTurn = useAppStore.getState().snapshot.turn;
      if ((playerColor === 'w' && currentTurn !== 'w') || (playerColor === 'b' && currentTurn !== 'b')) {
        return;
      }
    }
    applyMove(move);
    if (mode === 'ai') {
      window.setTimeout(() => {
        const aiMove = getAiMove(useAppStore.getState().snapshot.fen, aiDifficulty);
        if (aiMove) {
          applyMove(aiMove);
        }
      }, 700);
    }
    if (mode === 'online' && socket) {
      socket.emit('move', { roomCode: onlineRoom?.code ?? roomCode, move });
    }
  };

  const handleCreateRoom = () => {
    if (!socket) return;
    socket.emit('create-room', { username: settings.username });
  };

  const handleJoinRoom = () => {
    if (!socket) return;
    setJoinPromptOpen(true);
  };

  const submitJoinRoom = () => {
    if (!socket || !roomCode.trim()) return;
    socket.emit('join-room', { roomCode: roomCode.trim(), username: settings.username });
    setJoinPromptOpen(false);
  };

  const handleSendChat = () => {
    if (!socket || !chatText.trim()) return;
    socket.emit('chat-message', { roomCode: onlineRoom?.code ?? roomCode, content: chatText.trim() });
    setChatText('');
  };

  const handleImportFen = () => {
    const imported = importFenState(fenInput);
    if (imported) {
      useAppStore.setState({ snapshot: imported });
    }
  };

  const handleImportPgn = () => {
    const imported = importPgnState(pgnInput);
    if (imported) {
      useAppStore.setState({ snapshot: imported });
    }
  };

  const panel = (
    <div className="panel" style={{ background: `linear-gradient(145deg, ${theme === 'dark' ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.75)'}, ${theme === 'dark' ? 'rgba(6,10,21,0.95)' : 'rgba(245,245,255,0.95)'})` }}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{mode === 'home' ? 'Luxury Chess' : mode === 'online' ? 'Realtime Arena' : mode === 'ai' ? 'Stockfish Training' : 'Local Match'}</p>
          <h2>{settings.username}</h2>
        </div>
        <div className={`pill ${snapshot.isCheck ? 'check-badge' : ''}`}>
          {snapshot.isCheck ? 'CHECK' : snapshot.turn === 'w' ? 'White to move' : 'Black to move'}
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Status</span>
          <strong>{snapshot.status}</strong>
        </div>
        <div className="stat-card">
          <span>Clock</span>
          <strong>{settings.clock === 'unlimited' ? '∞' : settings.clock}</strong>
        </div>
      </div>
      <div className="controls-row">
        <button type="button" className="ghost-btn" onClick={() => undo()}>Undo</button>
        <button type="button" className="ghost-btn" onClick={() => redo()}>Redo</button>
        <button type="button" className="ghost-btn" onClick={() => reset()}>Restart</button>
      </div>
      <div className="controls-row">
        <button type="button" className="ghost-btn" onClick={() => setOrientation((value) => (value === 'white' ? 'black' : 'white'))}>Flip</button>
        <button type="button" className="ghost-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Theme</button>
      </div>
      {mode === 'ai' && !gameStarted && (
        <button type="button" className="action-btn" onClick={() => setGameStarted(true)}>
          Start
        </button>
      )}
      {(!gameStarted || mode !== 'ai') && (
        <>
          <label className="field">
            <span>Difficulty</span>
            <select value={aiDifficulty} onChange={(event) => setAiDifficulty(event.target.value as Difficulty)}>
              <option value="beginner">Beginner</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
              <option value="master">Master</option>
            </select>
          </label>
          <label className="field">
            <span>Board Theme</span>
            <select value={boardTheme} onChange={(event) => setBoardTheme(event.target.value as typeof boardTheme)}>
              <option value="classic">Classic</option>
              <option value="wood">Wood</option>
              <option value="marble">Marble</option>
              <option value="tournament">Tournament</option>
              <option value="neon">Neon</option>
            </select>
          </label>
        </>
      )}
      <label className="field">
        <span>Username</span>
        <input value={settings.username} onChange={(event) => updateSettings({ username: event.target.value })} />
      </label>
      {mode !== 'ai' || !gameStarted ? (
        <>
          <div className="textarea-group">
            <label className="field">
              <span>FEN Import</span>
              <textarea value={fenInput} onChange={(event) => setFenInput(event.target.value)} rows={3} />
            </label>
            <button type="button" className="action-btn" onClick={handleImportFen}>Load FEN</button>
          </div>
          <div className="textarea-group">
            <label className="field">
              <span>PGN Import</span>
              <textarea value={pgnInput} onChange={(event) => setPgnInput(event.target.value)} rows={3} />
            </label>
            <button type="button" className="action-btn" onClick={handleImportPgn}>Load PGN</button>
          </div>
        </>
      ) : null}
      <div className="controls-row">
        <button type="button" className="action-btn" onClick={() => navigator.clipboard.writeText(exportFen(snapshot))}>Copy FEN</button>
        <button type="button" className="action-btn" onClick={() => navigator.clipboard.writeText(exportPgn(snapshot))}>Copy PGN</button>
      </div>
    </div>
  );

  return (
    <div className={`app-shell ${theme}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Grandmaster Arena</p>
          <h1>Luxury chess for modern players.</h1>
        </div>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/play/local">Local</Link>
          <Link to="/play/ai">AI</Link>
          <Link to="/play/online">Online</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          <Link to="/profile">Profile</Link>
        </nav>
      </header>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="hero-grid"><div className="hero-card"><p className="eyebrow">Immersive play</p><h2>Play online, against AI, or in a private local match.</h2><p>Experience polished animations, instant synchronization, and a premium chess interface inspired by the best platforms in the world.</p><div className="controls-row"><button className="action-btn" onClick={() => { setMode('online'); navigate('/play/online'); }}>Play Online</button><button className="action-btn" onClick={() => { setMode('ai'); navigate('/play/ai'); }}>Play vs AI</button><button className="ghost-btn" onClick={() => { setMode('local'); navigate('/play/local'); }}>Local Match</button></div></div><div className="hero-card secondary"><p className="eyebrow">Highlights</p><ul className="feature-list"><li>Drag and click move support</li><li>Legal move highlights and last move markers</li><li>Draw, resign, rematch, and room-based multiplayer</li><li>PGN/FEN import and export</li></ul></div></motion.main>} />
          <Route path="/play/local" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="board-layout"><div className="board-card"><Board fen={snapshot.fen} sideToMove={snapshot.turn} onMove={handleMove} theme={theme} boardTheme={boardTheme} showLegalMoves={settings.showLegalMoves} legalMoves={legalMoves} lastMove={snapshot.lastMove ? { from: snapshot.lastMove.slice(0, 2), to: snapshot.lastMove.slice(2, 4) } : null} orientation={orientation} /></div>{panel}</motion.main>} />
          <Route path="/play/ai" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="board-layout"><div className="board-card"><Board fen={snapshot.fen} sideToMove={snapshot.turn} onMove={handleMove} theme={theme} boardTheme={boardTheme} showLegalMoves={settings.showLegalMoves} legalMoves={legalMoves} lastMove={snapshot.lastMove ? { from: snapshot.lastMove.slice(0, 2), to: snapshot.lastMove.slice(2, 4) } : null} orientation={orientation} /></div>{panel}</motion.main>} />
          <Route path="/play/online" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="board-layout"><div className="board-card"><Board fen={snapshot.fen} sideToMove={snapshot.turn} onMove={handleMove} theme={theme} boardTheme={boardTheme} showLegalMoves={settings.showLegalMoves} legalMoves={legalMoves} lastMove={snapshot.lastMove ? { from: snapshot.lastMove.slice(0, 2), to: snapshot.lastMove.slice(2, 4) } : null} orientation={orientation} /></div><div className="panel"><div className="panel-header"><div><p className="eyebrow">Socket room</p><h2>Realtime multiplayer</h2></div><div className="pill">{onlineRoom ? onlineRoom.code : 'offline'}</div></div><div className="room-status-box"><div className="pill">{playerTurnLabel}</div>{playerColor ? <div className="pill accent">{playerColor === 'w' ? 'You are White' : 'You are Black'}</div> : null}</div><div className="room-player-list">{onlineRoom?.players.length ? onlineRoom.players.map((playerName, index) => <div key={`${playerName}-${index}`} className="room-player-item"><span>{playerName}</span><strong>{index === 0 ? 'Host' : 'Opponent'}</strong></div>) : <div className="room-player-item empty"><span>No players yet</span><strong>Waiting</strong></div>}</div><div className="controls-row"><button className="action-btn" onClick={handleCreateRoom}>Create Room</button><button className="ghost-btn" onClick={handleJoinRoom}>Join Room</button></div>{joinPromptOpen ? <div className="room-dialog"><label className="field"><span>Room code</span><input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /></label><div className="controls-row"><button className="action-btn" onClick={submitJoinRoom}>Join</button><button className="ghost-btn" onClick={() => setJoinPromptOpen(false)}>Cancel</button></div></div> : <label className="field"><span>Room code</span><input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /></label>}<div className="chat-box">{chatMessages.map((message, index) => <div key={index} className="chat-item">{message}</div>)}</div><label className="field"><span>Chat</span><input value={chatText} onChange={(event) => setChatText(event.target.value)} /></label><button className="action-btn" onClick={handleSendChat}>Send</button></div></motion.main>} />
          <Route path="/leaderboard" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="hero-grid"><div className="hero-card"><p className="eyebrow">Top players</p><h2>Live leaderboard highlights.</h2>{leaderboard.map((player) => <div key={player.username} className="leader-row"><span>{player.username}</span><strong>{player.rating}</strong></div>)}</div><div className="hero-card secondary"><p className="eyebrow">Your profile</p><div className="profile-shell"><div className="avatar">{settings.avatar}</div><div><h3>{settings.username}</h3><p>Rating {defaultProfile.rating}</p><p>{defaultProfile.games} games • {defaultProfile.wins} wins</p></div></div></div></motion.main>} />
          <Route path="/profile" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="hero-grid"><div className="hero-card"><p className="eyebrow">Profile</p><div className="profile-shell"><div className="avatar">{settings.avatar}</div><div><h3>{settings.username}</h3><p>Rating {defaultProfile.rating}</p><p>Accuracy {defaultProfile.accuracy}%</p></div></div></div><div className="hero-card secondary"><p className="eyebrow">Stats</p><ul className="feature-list"><li>Games: {defaultProfile.games}</li><li>Wins: {defaultProfile.wins}</li><li>Losses: {defaultProfile.losses}</li><li>Draws: {defaultProfile.draws}</li></ul></div></motion.main>} />
        </Routes>
      </AnimatePresence>
    </div>
  );
};

export default App;
