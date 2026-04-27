/**
 * NetworkManager - WebSocket client for multiplayer
 */
export class NetworkManager {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.playerId = null;
    this.playerName = '';
    this.roomId = null;
    this.isHost = false;
    this.handlers = new Map();
    this.stateBuffer = null;
    this.sendInterval = null;
  }

  connect(url = 'ws://localhost:8080') {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.connected = true;
        console.log('[Net] Connected');
        resolve();
      };
      this.ws.onclose = () => {
        this.connected = false;
        console.log('[Net] Disconnected');
        this._emit('disconnected');
      };
      this.ws.onerror = (err) => {
        console.error('[Net] Error', err);
        reject(err);
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) { console.error('[Net] Parse error', e); }
      };
    });
  }

  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(handler);
  }

  off(type, handler) {
    const h = this.handlers.get(type);
    if (h) this.handlers.set(type, h.filter(fn => fn !== handler));
  }

  _emit(type, data) {
    const h = this.handlers.get(type);
    if (h) h.forEach(fn => fn(data));
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'NAME_SET':
        this.playerId = msg.id;
        this.playerName = msg.name;
        break;
      case 'ROOM_CREATED':
        this.roomId = msg.roomId;
        this.playerId = msg.playerId;
        this.isHost = true;
        break;
      case 'ROOM_JOINED':
        this.roomId = msg.roomId;
        this.playerId = msg.playerId;
        this.isHost = false;
        break;
      case 'HOST_TRANSFER':
        this.isHost = true;
        break;
      case 'ERROR':
        console.warn('[Net]', msg.msg);
        break;
    }
    this._emit(msg.type, msg);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  setName(name) { this.send({ type: 'SET_NAME', name }); }
  createRoom(password) { this.send({ type: 'CREATE_ROOM', password }); }
  joinRoom(roomId, password) { this.send({ type: 'JOIN_ROOM', roomId, password }); }
  leaveRoom() { this.send({ type: 'LEAVE_ROOM' }); this.roomId = null; }

  startGame(mapData) {
    this.send({ type: 'START_GAME', mapData });
  }

  sendPlayerUpdate(pos, rotY, health, isDead) {
    this.send({ type: 'PLAYER_UPDATE', pos: { x: pos.x, y: pos.y, z: pos.z }, rotY, health, isDead });
  }

  sendGameState(enemies, items) {
    this.send({ type: 'GAME_STATE', enemies, items });
  }

  sendChat(text) { this.send({ type: 'CHAT', text }); }
  sendItemPickup(itemIndex) { this.send({ type: 'ITEM_PICKUP', itemIndex }); }
  sendPortalEnter() { this.send({ type: 'PORTAL_ENTER' }); }
  sendUseItem(slotIndex) { this.send({ type: 'USE_ITEM', slotIndex }); }

  disconnect() {
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
    this.roomId = null;
  }
}
