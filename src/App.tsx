import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import Board from './components/Board';
import Panel from './components/Panel';
import { getAiMove, getLegalMoves, importFen as importFenState } from './lib/chess';
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
  const [drawerOpen] = useState(true);
  const theme = useAppStore((state) => state.theme);
  const boardTheme = useAppStore((state) => state.boardTheme);
  const settings = useAppStore((state) => state.settings);
  const snapshot = useAppStore((state) => state.snapshot);
  const applyMove = useAppStore((state) => state.applyMove);
  const setMode = useAppStore((state) => state.setMode);

  const [roomCode, setRoomCode] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<RoomSummary | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null);
  const [joinPromptOpen, setJoinPromptOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [chatText, setChatText] = useState('');
  const [pendingCreateRoom, setPendingCreateRoom] = useState(false);
  const [roomCreatedMsg, setRoomCreatedMsg] = useState<string | null>(null);
  const [aiDifficulty] = useState<Difficulty>('medium');
  const [orientation] = useState<'white' | 'black'>('white');

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

  // mode-driven effects handled elsewhere

  useEffect(() => {
    if (mode !== 'online') return;
    const client = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', { transports: ['websocket'] });
    client.on('connect', () => {
      setSocket(client);
      if (pendingCreateRoom) {
        client.emit('create-room', { username: settings.username });
        setPendingCreateRoom(false);
      }
    });
    client.on('room-created', (payload: { room: RoomSummary; playerColor: 'w' | 'b'; fen: string }) => {
      setOnlineRoom(payload.room);
      setPlayerColor(payload.playerColor);
      useAppStore.setState({ mode: 'online' });
      useAppStore.setState({ snapshot: { ...useAppStore.getState().snapshot, fen: payload.fen } });
      setRoomCreatedMsg(`Room ${payload.room.code} created`);
      window.setTimeout(() => setRoomCreatedMsg(null), 4500);
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

  const handleMove = (from: string, to: string, promotion?: string) => {
    const move = `${from}${to}${promotion ?? ''}`;
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
    if (!socket) {
      setPendingCreateRoom(true);
      setMode('online');
      navigate('/play/online');
      return;
    }
    socket.emit('create-room', { username: settings.username });
  };

  const topbarCreateRoom = () => {
    setMode('online');
    navigate('/play/online');
    if (socket) handleCreateRoom();
    else setPendingCreateRoom(true);
  };

  // join handled via Panel UI

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


  const Navigation = () => {
    const location = useLocation();
    return (
      <nav className="nav-links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
        <Link to="/play/local" className={location.pathname.includes('/play') ? 'active' : ''}>Play</Link>
        <Link to="/leaderboard" className={location.pathname === '/leaderboard' ? 'active' : ''}>Leaderboard</Link>
        <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>Profile</Link>
        <button type="button" className="nav-play-btn ghost-btn" onClick={() => { setMode('local'); navigate('/play/local'); }}>
          🎯 New Game
        </button>
      </nav>
    );
  };


  return (
    <div className={`app-shell ${theme}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Minimal Chess</p>
          <h1>Clean board, calm focus.</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="ghost-btn" onClick={() => { setMode('ai'); navigate('/play/ai'); }}>Challenge AI</button>
          <button type="button" className="action-btn" onClick={topbarCreateRoom}>Create Room</button>
          <Navigation />
        </div>
      </header>

      {roomCreatedMsg ? (
        <div style={{ position: 'fixed', top: 78, left: '50%', transform: 'translateX(-50%)', zIndex: 60 }}>
          <div className="pill check-badge">{roomCreatedMsg}</div>
        </div>
      ) : null}
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="hero-grid"><div className="hero-card hero-main"><p className="eyebrow">Minimal Chess</p><h2>Sharp board. Quiet interface.</h2><p>Every move is clear, every game feels calm, and the interface stays out of the way.</p><div className="controls-row hero-actions"><button className="action-btn" onClick={() => { setMode('local'); navigate('/play/local'); }}>Play Now</button><button className="ghost-btn" onClick={() => { setMode('ai'); navigate('/play/ai'); }}>Challenge AI</button></div></div><div className="hero-card secondary"><p className="eyebrow">Why it works</p><ul className="feature-list minimal-list"><li>Focused board first</li><li>Simple controls, instant play</li><li>Clear capture tracking</li></ul></div></motion.main>} />
          <Route path="/play/local" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="board-layout"><div className="board-card"><Board fen={snapshot.fen} sideToMove={snapshot.turn} onMove={handleMove} theme={theme} boardTheme={boardTheme} showLegalMoves={settings.showLegalMoves} legalMoves={legalMoves} lastMove={snapshot.lastMove ? { from: snapshot.lastMove.slice(0, 2), to: snapshot.lastMove.slice(2, 4) } : null} orientation={orientation} /></div><aside className={`right-drawer ${drawerOpen ? 'open' : 'closed'}`}><Panel mode={mode} roomCode={roomCode} setRoomCode={setRoomCode} onlineRoom={onlineRoom} joinPromptOpen={joinPromptOpen} setJoinPromptOpen={setJoinPromptOpen} handleCreateRoom={handleCreateRoom} submitJoinRoom={submitJoinRoom} chatMessages={chatMessages} chatText={chatText} setChatText={setChatText} handleSendChat={handleSendChat} playerTurnLabel={playerTurnLabel} /></aside></motion.main>} />
          <Route path="/play/ai" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="board-layout"><div className="board-card"><Board fen={snapshot.fen} sideToMove={snapshot.turn} onMove={handleMove} theme={theme} boardTheme={boardTheme} showLegalMoves={settings.showLegalMoves} legalMoves={legalMoves} lastMove={snapshot.lastMove ? { from: snapshot.lastMove.slice(0, 2), to: snapshot.lastMove.slice(2, 4) } : null} orientation={orientation} /></div><aside className={`right-drawer ${drawerOpen ? 'open' : 'closed'}`}><Panel mode={mode} roomCode={roomCode} setRoomCode={setRoomCode} onlineRoom={onlineRoom} joinPromptOpen={joinPromptOpen} setJoinPromptOpen={setJoinPromptOpen} handleCreateRoom={handleCreateRoom} submitJoinRoom={submitJoinRoom} chatMessages={chatMessages} chatText={chatText} setChatText={setChatText} handleSendChat={handleSendChat} playerTurnLabel={playerTurnLabel} /></aside></motion.main>} />
          <Route path="/play/online" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="board-layout"><div className="board-card"><Board fen={snapshot.fen} sideToMove={snapshot.turn} onMove={handleMove} theme={theme} boardTheme={boardTheme} showLegalMoves={settings.showLegalMoves} legalMoves={legalMoves} lastMove={snapshot.lastMove ? { from: snapshot.lastMove.slice(0, 2), to: snapshot.lastMove.slice(2, 4) } : null} orientation={orientation} /></div><aside className={`right-drawer ${drawerOpen ? 'open' : 'closed'}`}><Panel mode={mode} roomCode={roomCode} setRoomCode={setRoomCode} onlineRoom={onlineRoom} joinPromptOpen={joinPromptOpen} setJoinPromptOpen={setJoinPromptOpen} handleCreateRoom={handleCreateRoom} submitJoinRoom={submitJoinRoom} chatMessages={chatMessages} chatText={chatText} setChatText={setChatText} handleSendChat={handleSendChat} playerTurnLabel={playerTurnLabel} /></aside></motion.main>} />
          <Route path="/leaderboard" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="hero-grid"><div className="hero-card"><p className="eyebrow">Top players</p><h2>Live leaderboard highlights.</h2>{leaderboard.map((player) => <div key={player.username} className="leader-row"><span>{player.username}</span><strong>{player.rating}</strong></div>)}</div><div className="hero-card secondary"><p className="eyebrow">Your profile</p><div className="profile-shell"><div className="avatar">{settings.avatar}</div><div><h3>{settings.username}</h3><p>Rating {defaultProfile.rating}</p><p>{defaultProfile.games} games • {defaultProfile.wins} wins</p></div></div></div></motion.main>} />
          <Route path="/profile" element={<motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="hero-grid"><div className="hero-card"><p className="eyebrow">Profile</p><div className="profile-shell"><div className="avatar">{settings.avatar}</div><div><h3>{settings.username}</h3><p>Rating {defaultProfile.rating}</p><p>Accuracy {defaultProfile.accuracy}%</p></div></div></div><div className="hero-card secondary"><p className="eyebrow">Stats</p><ul className="feature-list"><li>Games: {defaultProfile.games}</li><li>Wins: {defaultProfile.wins}</li><li>Losses: {defaultProfile.losses}</li><li>Draws: {defaultProfile.draws}</li></ul></div></motion.main>} />
        </Routes>
      </AnimatePresence>
    </div>
  );

  
};

export default App;
