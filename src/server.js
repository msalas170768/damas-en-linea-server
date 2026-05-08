'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createRoom, joinRoom, getRoomBySocket, removePlayer, getPlayer } = require('./roomManager');
const { getValidActions, applyMove, getWinner, getPieceCaptures } = require('./checkers');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// CLIENT_URL can be a single origin, comma-separated list, or * (all origins).
const rawOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
const corsOrigin = rawOrigin === '*'
  ? '*'
  : rawOrigin.includes(',')
    ? rawOrigin.split(',').map(s => s.trim())
    : rawOrigin;

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  console.log('connected:', socket.id);

  socket.on('create_room', ({ name }) => {
    const trimmed = name?.trim();
    if (!trimmed) return socket.emit('error', { message: 'El nombre no puede estar vacío' });

    const room = createRoom(socket.id, trimmed);
    socket.join(room.code);
    socket.emit('room_created', { code: room.code });
  });

  socket.on('join_room', ({ code, name }) => {
    const trimmedName = name?.trim();
    const trimmedCode = code?.trim().toUpperCase();
    if (!trimmedName) return socket.emit('error', { message: 'El nombre no puede estar vacío' });
    if (!trimmedCode) return socket.emit('error', { message: 'Código de sala requerido' });

    const result = joinRoom(trimmedCode, socket.id, trimmedName);
    if (result.error) return socket.emit('error', { message: result.error });

    const room = result.room;
    socket.join(room.code);

    room.players.forEach(player => {
      const opponent = room.players.find(p => p.socketId !== player.socketId);
      io.to(player.socketId).emit('game_start', {
        board: room.board,
        myColor: player.color,
        myName: player.name,
        opponentName: opponent?.name ?? '',
        currentTurn: room.currentTurn,
      });
    });
  });

  socket.on('request_valid_moves', ({ row, col }) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.status !== 'playing') return;

    const player = getPlayer(room, socket.id);
    if (!player || player.color !== room.currentTurn) {
      return socket.emit('valid_moves', { captures: [], moves: [] });
    }

    const piece = room.board[row]?.[col];
    if (!piece || piece.player !== player.color) {
      return socket.emit('valid_moves', { captures: [], moves: [] });
    }

    const { captures, moves } = getValidActions(room.board, row, col, room.mandatoryPiece);
    socket.emit('valid_moves', { captures, moves });
  });

  socket.on('make_move', ({ from, to }) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.status !== 'playing') return;

    const player = getPlayer(room, socket.id);
    if (!player || player.color !== room.currentTurn) {
      return socket.emit('error', { message: 'No es tu turno' });
    }

    const [fr, fc] = from;
    const [tr, tc] = to;

    const piece = room.board[fr]?.[fc];
    if (!piece || piece.player !== player.color) {
      return socket.emit('error', { message: 'Pieza inválida' });
    }

    const { captures, moves } = getValidActions(room.board, fr, fc, room.mandatoryPiece);
    const isCapture = captures.some(c => c.to[0] === tr && c.to[1] === tc);
    const isMove = moves.some(([r, c]) => r === tr && c === tc);
    if (!isCapture && !isMove) {
      return socket.emit('error', { message: 'Movimiento inválido' });
    }

    const wasKing = piece.king;
    const { board: newBoard, capturedPos } = applyMove(room.board, fr, fc, tr, tc);
    room.board = newBoard;

    let multiJump = false;
    let nextTurn = player.color;

    if (capturedPos) {
      const newlyKinged = !wasKing && newBoard[tr][tc].king;
      const furtherCaptures = getPieceCaptures(newBoard, tr, tc);

      if (furtherCaptures.length > 0 && !newlyKinged) {
        room.mandatoryPiece = [tr, tc];
        multiJump = true;
      } else {
        room.mandatoryPiece = null;
        nextTurn = player.color === 'red' ? 'black' : 'red';
      }
    } else {
      room.mandatoryPiece = null;
      nextTurn = player.color === 'red' ? 'black' : 'red';
    }

    room.currentTurn = nextTurn;

    const winner = getWinner(newBoard, nextTurn);
    if (winner) {
      room.status = 'finished';
      const winnerPlayer = room.players.find(p => p.color === winner);
      return io.to(room.code).emit('game_over', {
        board: newBoard,
        winner,
        winnerName: winnerPlayer?.name ?? '',
      });
    }

    io.to(room.code).emit('board_update', {
      board: newBoard,
      currentTurn: nextTurn,
      lastMove: { from, to },
      capturedPos,
      multiJump,
      mandatoryPiece: multiJump ? [tr, tc] : null,
    });
  });

  socket.on('disconnect', () => {
    const room = getRoomBySocket(socket.id);
    if (room) {
      const remaining = room.players.find(p => p.socketId !== socket.id);
      if (remaining) io.to(remaining.socketId).emit('opponent_disconnected');
    }
    removePlayer(socket.id);
    console.log('disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
