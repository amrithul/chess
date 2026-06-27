import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { Chess } from 'chess.js';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'chess-server' });
});

interface RoomPlayer {
  id: string;
  username: string;
  color: 'white' | 'black';
}

interface RoomState {
  code: string;
  players: RoomPlayer[];
  spectators: string[];
  messages: string[];
  fen: string;
}

const rooms = new Map<string, RoomState>();

io.on('connection', (socket) => {
  socket.on('create-room', ({ username }) => {
    const code = generateRoomCode();
    const initialFen = new Chess().fen();
    const room: RoomState = {
      code,
      players: [{ id: socket.id, username, color: 'white' }],
      spectators: [],
      messages: [],
      fen: initialFen,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.emit('room-created', {
      room: { id: code, code, players: room.players.map((player) => player.username), spectatorCount: 0, status: 'waiting' },
      playerColor: 'w',
      fen: room.fen,
    });
  });

  socket.on('join-room', ({ roomCode, username }) => {
    const code = roomCode.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    room.players.push({ id: socket.id, username, color: 'black' });
    socket.join(code);
    const roomSummary = { id: code, code, players: room.players.map((player) => player.username), spectatorCount: room.spectators.length, status: 'playing' };
    socket.emit('room-joined', { room: roomSummary, playerColor: 'b', fen: room.fen });
    io.to(code).emit('room-update', { room: roomSummary });
  });

  socket.on('move', ({ roomCode, move }) => {
    const code = roomCode.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return;

    const chess = new Chess(room.fen);
    try {
      chess.move(move);
      room.fen = chess.fen();
      io.to(code).emit('move-applied', { fen: room.fen, move });
    } catch {
      socket.emit('error', { message: 'Invalid move' });
    }
  });

  socket.on('chat-message', ({ roomCode, content }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.messages.push(content);
    io.to(roomCode).emit('chat-message', { content });
  });

  socket.on('offer-draw', ({ roomCode }) => {
    io.to(roomCode).emit('draw-offered', {});
  });

  socket.on('accept-draw', ({ roomCode }) => {
    io.to(roomCode).emit('draw-accepted', {});
  });

  socket.on('decline-draw', ({ roomCode }) => {
    io.to(roomCode).emit('draw-declined', {});
  });

  socket.on('resign', ({ roomCode }) => {
    io.to(roomCode).emit('resigned', {});
  });

  socket.on('rematch', ({ roomCode }) => {
    io.to(roomCode).emit('rematch-requested', {});
  });

  socket.on('spectator-join', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.spectators.push('spectator');
    io.to(roomCode).emit('room-update', { room: { id: roomCode, code: roomCode, players: room.players, spectatorCount: room.spectators.length, status: 'playing' } });
  });
});

function generateRoomCode() {
  return String(Math.floor(100 + Math.random() * 900));
}

const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => {
  console.log(`Chess server listening on ${port}`);
});
