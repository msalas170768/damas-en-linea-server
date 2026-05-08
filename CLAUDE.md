# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start production server
npm start

# Start dev server with auto-reload
npm run dev
```

No test suite or linter is configured.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP / WebSocket port |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin(s). Accepts a single URL, a comma-separated list, or `*`. |

## Architecture

This is a Node.js WebSocket game server for an online checkers (draughts) game. There is no REST API beyond a `/health` endpoint — all gameplay is driven by Socket.IO events.

**Three source files, clear separation of concerns:**

- `src/checkers.js` — Pure game logic with no I/O. Exports board creation, move validation, move application, and win detection. All functions are stateless and operate on plain board arrays.
- `src/roomManager.js` — In-memory room registry (`Map`). Manages room lifecycle (create, join, find by socket, remove player). Room state includes the board, whose turn it is, game status, and `mandatoryPiece` for multi-jump tracking.
- `src/server.js` — Express + Socket.IO entry point. Wires socket events to roomManager and checkers logic. Owns all side effects: emitting events, joining Socket.IO rooms, logging.

## Socket.IO Event Protocol

**Client → Server:**
- `create_room` `{ name }` — Creates a room; server replies with `room_created { code }`.
- `join_room` `{ code, name }` — Joins a room; triggers `game_start` for both players.
- `request_valid_moves` `{ row, col }` — Server replies with `valid_moves { captures, moves }` for the requesting player's piece only.
- `make_move` `{ from: [r,c], to: [r,c] }` — Applies a move. Server emits `board_update` or `game_over` to the room.

**Server → Client:**
- `room_created` `{ code }`
- `game_start` `{ board, myColor, myName, opponentName, currentTurn }`
- `valid_moves` `{ captures, moves }` — `captures` is `[{ to: [r,c], captured: [r,c] }]`; `moves` is `[[r,c], ...]`.
- `board_update` `{ board, currentTurn, lastMove, capturedPos, multiJump, mandatoryPiece }`
- `game_over` `{ board, winner, winnerName }`
- `opponent_disconnected`
- `error` `{ message }`

## Key Game Rules Implemented

- **Mandatory capture**: if any piece of the current player can capture, only captures are valid moves that turn.
- **Multi-jump**: after a capture, if the same piece can capture again it must; the turn only ends when no further captures are available from that piece. Kinged pieces do not continue a multi-jump chain on the same turn they are kinged.
- **Promotion**: red pieces reaching row 0 or black pieces reaching row 7 become kings. Kings capture and move in all four diagonal directions.
- **Win condition**: a player wins when the opponent has no legal moves (no pieces, or all pieces are blocked).
