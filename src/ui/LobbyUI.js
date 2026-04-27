/**
 * LobbyUI - Room creation, joining, and player list
 */
export class LobbyUI {
  constructor(networkManager) {
    this.net = networkManager;
    this.lobbyScreen = document.getElementById('lobby-screen');
    this.lobbyContent = document.getElementById('lobby-content');
    this.roomView = document.getElementById('room-view');
    this.playerList = document.getElementById('player-list');
    this.roomIdDisplay = document.getElementById('room-id-display');
    this.startBtn = document.getElementById('lobby-start-btn');
    this.onStartGame = null;
    this.onBack = null;
    this._setup();
  }

  _setup() {
    document.getElementById('create-room-btn').addEventListener('click', () => {
      const pw = document.getElementById('room-password-input').value;
      const name = document.getElementById('player-name-input').value || 'Player';
      this.net.setName(name);
      setTimeout(() => this.net.createRoom(pw), 100);
    });

    document.getElementById('join-room-btn').addEventListener('click', () => {
      const id = document.getElementById('join-room-id').value.toUpperCase();
      const pw = document.getElementById('join-room-pw').value;
      const name = document.getElementById('player-name-input').value || 'Player';
      if (!id) return;
      this.net.setName(name);
      setTimeout(() => this.net.joinRoom(id, pw), 100);
    });

    document.getElementById('leave-room-btn').addEventListener('click', () => {
      this.net.leaveRoom();
      this._showJoinView();
    });

    document.getElementById('lobby-back-btn').addEventListener('click', () => {
      this.net.leaveRoom();
      this.hide();
      if (this.onBack) this.onBack();
    });

    this.startBtn.addEventListener('click', () => {
      if (this.onStartGame) this.onStartGame();
    });

    // Network events
    this.net.on('ROOM_CREATED', (msg) => this._showRoomView(msg.roomId));
    this.net.on('ROOM_JOINED', (msg) => this._showRoomView(msg.roomId));
    this.net.on('ROOM_INFO', (msg) => this._updatePlayerList(msg));
    this.net.on('ERROR', (msg) => this._showError(msg.msg));
  }

  show() {
    this.lobbyScreen.classList.remove('hidden');
    this._showJoinView();
  }

  hide() {
    this.lobbyScreen.classList.add('hidden');
  }

  _showJoinView() {
    this.lobbyContent.classList.remove('hidden');
    this.roomView.classList.add('hidden');
  }

  _showRoomView(roomId) {
    this.lobbyContent.classList.add('hidden');
    this.roomView.classList.remove('hidden');
    this.roomIdDisplay.textContent = roomId;
    this.startBtn.style.display = this.net.isHost ? 'inline-block' : 'none';
  }

  _updatePlayerList(msg) {
    this.playerList.innerHTML = '';
    msg.players.forEach(p => {
      const li = document.createElement('div');
      li.className = 'lobby-player';
      li.innerHTML = `<span class="lobby-player-name">${p.name}</span>${p.isHost ? '<span class="lobby-host-badge">HOST</span>' : ''}`;
      this.playerList.appendChild(li);
    });
    this.startBtn.style.display = this.net.isHost ? 'inline-block' : 'none';
  }

  _showError(msg) {
    const el = document.getElementById('lobby-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }
}
