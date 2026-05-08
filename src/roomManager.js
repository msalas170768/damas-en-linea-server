'use strict';

const { createInitialBoard } = require('./checkers');

const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createRoom(socketId, playerName) {
  let code;
  do { code = generateCode(); } while (rooms.has(code));

  const room = {
    code,
    players: [{ socketId, name: playerName, color: 'red' }],
    board: createInitialBoard(),
    currentTurn: 'red',
    status: 'waiting',
    winner: null,
    mandatoryPiece: null,
  };

  rooms.set(code, room);
  return room;
}

function joinRoom(code, socketId, playerName) {
  const room = rooms.get(code);
  if (!room) return { error: 'Sala no encontrada' };
  if (room.status !== 'waiting') return { error: 'La sala ya está completa' };
  if (room.players.some(p => p.socketId === socketId)) return { error: 'Ya estás en esta sala' };

  room.players.push({ socketId, name: playerName, color: 'black' });
  room.status = 'playing';
  return { room };
}

function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.socketId === socketId)) return room;
  }
  return null;
}

function removePlayer(socketId) {
  const room = getRoomBySocket(socketId);
  if (!room) return null;
  room.players = room.players.filter(p => p.socketId !== socketId);
  if (room.players.length === 0) rooms.delete(room.code);
  return room;
}

function getPlayer(room, socketId) {
  return room.players.find(p => p.socketId === socketId);
}

module.exports = { createRoom, joinRoom, getRoomBySocket, removePlayer, getPlayer };
