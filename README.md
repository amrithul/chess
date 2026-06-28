# Luxury Chess

A polished chess web app with local play, AI practice, and socket-based online rooms.

## Features
- React + TypeScript frontend
- Express + Socket.IO backend
- Chess rules via chess.js
- Stockfish-inspired AI heuristics
- Glassmorphism UI and responsive layout

## Scripts
- npm run dev
- npm run build
- npx tsx server/index.ts

## Docker
```bash
docker compose up --build
```

## Environment
Copy .env.example to .env and customize it.

## Vercel Deployment
Vercel can host the React frontend, but it cannot run the current Socket.IO server in `server/index.ts` as a long-lived process.

Deploy the frontend to Vercel and host the backend on a persistent Node service elsewhere, then set `VITE_SOCKET_URL` to that backend URL during the Vercel build.
