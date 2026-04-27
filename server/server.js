import { WebSocketServer } from 'ws';
import { createServer } from 'http';

/**
 * Horror Game - WebSocket Relay Server (Render compatible)
 */
const PORT = process.env.PORT || 8080;
const MAX_PLAYERS = 4;
const rooms = new Map();
let nextPlayerId = 1;

// HTTP server for health checks (UptimeRobot)
const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size, uptime: process.uptime() }));
  } else {
    res.writeHead(404); res.end();
  }
});

const wss = new WebSocketServer({ server: httpServer });
console.log(`[Server] Starting on port ${PORT}...`);

wss.on('connection', (ws) => {
  const playerId = nextPlayerId++;
  ws.playerId = playerId;
  ws.roomId = null;
  ws.playerName = `Player${playerId}`;
  console.log(`[Server] Player ${playerId} connected`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.type) {
      case 'SET_NAME': ws.playerName = (msg.name || `Player${playerId}`).substring(0, 16); send(ws, { type: 'NAME_SET', name: ws.playerName, id: playerId }); break;
      case 'CREATE_ROOM': createRoom(ws, msg.password || ''); break;
      case 'JOIN_ROOM': joinRoom(ws, msg.roomId, msg.password || ''); break;
      case 'LEAVE_ROOM': leaveRoom(ws); break;
      case 'START_GAME': startGame(ws, msg); break;
      case 'PLAYER_UPDATE': relayToRoom(ws, msg, true); break;
      case 'GAME_STATE': relayToRoom(ws, msg, false); break;
      case 'ITEM_PICKUP': case 'PORTAL_ENTER': case 'USE_ITEM': case 'REVIVE_REQUEST': case 'GUN_SHOT':
        relayToHost(ws, msg); break;
      case 'PLAYER_DAMAGE': case 'PLAYER_DIED': case 'ITEM_PICKED': case 'FRAGMENT_UPDATE':
      case 'PORTAL_CREATED': case 'GAME_CLEAR': case 'GAME_OVER': case 'PLAYER_REVIVED':
      case 'ENEMY_HIT': case 'ENEMY_KILLED':
        relayToRoom(ws, msg, false); break;
      case 'CHAT': broadcastToRoom(ws, { type: 'CHAT', sender: ws.playerName, text: (msg.text || '').substring(0, 200) }); break;
    }
  });
  ws.on('close', () => { console.log(`[Server] Player ${playerId} disconnected`); leaveRoom(ws); });
});

function send(ws, d) { if (ws.readyState === 1) ws.send(JSON.stringify(d)); }

function createRoom(ws, password) {
  if (ws.roomId) leaveRoom(ws);
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  rooms.set(roomId, { id: roomId, password, host: ws, players: [ws], started: false });
  ws.roomId = roomId; ws.isHost = true;
  send(ws, { type: 'ROOM_CREATED', roomId, playerId: ws.playerId, isHost: true });
  broadcastRoomInfo(rooms.get(roomId));
  console.log(`[Server] Room ${roomId} created`);
}

function joinRoom(ws, roomId, password) {
  if (ws.roomId) leaveRoom(ws);
  const room = rooms.get(roomId);
  if (!room) { send(ws, { type: 'ERROR', msg: 'ルームが見つかりません' }); return; }
  if (room.password && room.password !== password) { send(ws, { type: 'ERROR', msg: 'パスワードが違います' }); return; }
  if (room.players.length >= MAX_PLAYERS) { send(ws, { type: 'ERROR', msg: 'ルームが満員です' }); return; }
  if (room.started) { send(ws, { type: 'ERROR', msg: 'ゲームが既に開始しています' }); return; }
  room.players.push(ws); ws.roomId = roomId; ws.isHost = false;
  send(ws, { type: 'ROOM_JOINED', roomId, playerId: ws.playerId, isHost: false });
  broadcastRoomInfo(room);
}

function leaveRoom(ws) {
  if (!ws.roomId) return;
  const room = rooms.get(ws.roomId); if (!room) { ws.roomId = null; return; }
  room.players = room.players.filter(p => p !== ws); ws.roomId = null;
  if (room.players.length === 0) { rooms.delete(room.id); }
  else {
    if (room.host === ws) { room.host = room.players[0]; room.host.isHost = true; send(room.host, { type: 'HOST_TRANSFER' }); }
    broadcastRoomInfo(room);
    broadcastToRoom(ws, { type: 'PLAYER_LEFT', playerId: ws.playerId, name: ws.playerName });
  }
}

function startGame(ws, msg) {
  const room = rooms.get(ws.roomId); if (!room || room.host !== ws) return;
  room.started = true;
  room.players.forEach(p => send(p, { type: 'GAME_START', mapData: msg.mapData, hostId: ws.playerId,
    players: room.players.map(pl => ({ id: pl.playerId, name: pl.playerName, isHost: pl.isHost })) }));
}

function relayToRoom(ws, msg, toHostOnly) {
  const room = rooms.get(ws.roomId); if (!room) return;
  msg.senderId = ws.playerId; msg.senderName = ws.playerName;
  if (toHostOnly) { if (room.host !== ws) send(room.host, msg); }
  else { room.players.forEach(p => { if (p !== ws) send(p, msg); }); }
}

function relayToHost(ws, msg) {
  const room = rooms.get(ws.roomId); if (!room) return;
  msg.senderId = ws.playerId; send(room.host, msg);
}

function broadcastToRoom(ws, msg) {
  const room = rooms.get(ws.roomId); if (!room) return;
  room.players.forEach(p => send(p, msg));
}

function broadcastRoomInfo(room) {
  const info = { type: 'ROOM_INFO', roomId: room.id,
    players: room.players.map(p => ({ id: p.playerId, name: p.playerName, isHost: p === room.host })), started: room.started };
  room.players.forEach(p => send(p, info));
}

httpServer.listen(PORT, () => console.log(`[Server] Listening on port ${PORT}`));
