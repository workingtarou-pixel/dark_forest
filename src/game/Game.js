import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Player, RemotePlayer } from './Player.js';
import { World } from './World.js';
import { Flashlight } from './Flashlight.js';
import { Ember } from './enemies/Ember.js';
import { Dester } from './enemies/Dester.js';
import { Runder } from './enemies/Runder.js';
import { ItemSystem } from './items/ItemSystem.js';
import { AudioManager } from '../audio/AudioManager.js';
import { HUD } from '../ui/HUD.js';
import { Minimap } from '../ui/Minimap.js';
import { JumpScare } from '../ui/JumpScare.js';
import { MenuScreen } from '../ui/MenuScreen.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { LobbyUI } from '../ui/LobbyUI.js';

export class Game {
  constructor() {
    this.state = 'MENU'; this.clock = new THREE.Clock();
    this.scene = null; this.camera = null; this.renderer = null; this.controls = null;
    this.player = null; this.world = null; this.flashlight = null; this.itemSystem = null;
    this.audio = new AudioManager(); this.enemies = []; this.allEnemyEntities = [];
    this.brightness = 1.0; this.volume = 0.6;
    this.hud = new HUD(); this.minimap = null; this.jumpScare = null;
    this.menu = new MenuScreen(); this.net = new NetworkManager(); this.lobby = null;
    this.isMultiplayer = false; this.remotePlayers = new Map();
    this.chatOpen = false; this.syncTimer = 0;
    this.playersInPortal = new Set(); this.totalPlayers = 1; this.alivePlayers = 1;
    this.hutWalls = [];
    // Gun system
    this.hasGun = false; this.ammo = 0; this.raycaster = new THREE.Raycaster();
    this._initRenderer(); this._initScene();
    this._setupEvents(); this._setupMenus(); this._setupChat();
    this._animate();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    document.getElementById('game-container').appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 150);
    this.camera.position.set(0, 1.7, 0);
    this.controls = new PointerLockControls(this.camera, document.body);
  }

  _setupEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth/window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    document.addEventListener('keydown', e => this._onKey(e));
    document.addEventListener('keyup', e => { if (this.state === 'PLAYING') this.player.handleKeyUp(e.code); });
    document.addEventListener('mousedown', e => { if (e.button === 0 && this.state === 'PLAYING' && this.hasGun) this._shoot(); });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) this.menu.hidePointerPrompt();
      else if (this.state === 'PLAYING') this.menu.showPointerPrompt();
    });
    document.getElementById('pointer-lock-prompt').addEventListener('click', () => {
      if (this.state === 'PLAYING' || this.state === 'PAUSED') this.controls.lock();
    });
  }

  _onKey(e) {
    if (this.chatOpen) { this._chatKey(e); return; }
    if (e.code === 'KeyE') {
      if (this.state === 'PLAYING') { this._pause(); return; }
      if (this.state === 'PAUSED') { this._resume(); return; }
    }
    if (e.code === 'KeyT' && this.state === 'PLAYING') { this._openChat(); return; }
    if (this.state !== 'PLAYING') return;
    this.player.handleKeyDown(e.code);
    if (e.code === 'Digit1') this.flashlight.toggle();
    if (e.code >= 'Digit2' && e.code <= 'Digit5') this._useItem(parseInt(e.code.replace('Digit','')) - 2);
    if (e.code === 'KeyF') this.flashlight.toggle();
    if (e.code === 'KeyR') {
      if (this.itemSystem.isNearPortal(this.player.position)) this._enterPortal();
      else this.itemSystem.tryPickup(this.player.position, this.hasGun);
    }
    if (e.code === 'KeyQ' && this.itemSystem.hasLightOrb) {
      const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      this.itemSystem.createPortal(this.player.position.clone().add(dir.multiplyScalar(5)));
    }
  }

  _setupMenus() {
    this.menu.onStart = () => this._startGame(false);
    this.menu.onRetry = () => this._startGame(this.isMultiplayer);
    document.getElementById('multi-button').addEventListener('click', () => this._openMultiplayer());
    document.getElementById('resume-button').addEventListener('click', () => this._resume());
    document.getElementById('brightness-slider').addEventListener('input', e => {
      const v = parseInt(e.target.value);
      document.getElementById('brightness-value').textContent = `${v}%`;
      this.brightness = v/100; this._applyBrightness();
    });
    document.getElementById('volume-slider').addEventListener('input', e => {
      const v = parseInt(e.target.value);
      document.getElementById('volume-value').textContent = `${v}%`;
      this.volume = v/100;
      if (this.audio.masterGain) this.audio.masterGain.gain.value = this.volume;
    });
  }

  _setupChat() {
    document.getElementById('chat-input').addEventListener('keydown', e => e.stopPropagation());
  }
  _chatKey(e) {
    if (e.code === 'Enter') {
      const inp = document.getElementById('chat-input');
      const t = inp.value.trim();
      if (t) { if (this.isMultiplayer) this.net.sendChat(t); else this._addChat('You', t); inp.value = ''; }
      this._closeChat();
    }
    if (e.code === 'Escape') this._closeChat();
  }
  _openChat() { this.chatOpen = true; document.getElementById('chat-container').classList.remove('hidden'); document.getElementById('chat-input-box').classList.remove('hidden'); document.getElementById('chat-input').focus(); }
  _closeChat() { this.chatOpen = false; document.getElementById('chat-input-box').classList.add('hidden'); document.getElementById('chat-input').value = ''; }
  _addChat(s, t, sys = false) {
    const log = document.getElementById('chat-log');
    document.getElementById('chat-container').classList.remove('hidden');
    const m = document.createElement('div'); m.className = 'chat-msg' + (sys ? ' system' : '');
    m.innerHTML = sys ? t : `<span class="chat-sender">${s}</span>${t}`;
    log.appendChild(m); log.scrollTop = log.scrollHeight;
    while (log.children.length > 50) log.firstChild.remove();
  }

  _pause() { if (this.state !== 'PLAYING') return; this.state = 'PAUSED'; this.controls.unlock(); this.clock.stop(); document.getElementById('pause-screen').classList.remove('hidden'); this.menu.hidePointerPrompt(); this.player.moveForward = this.player.moveBackward = this.player.moveLeft = this.player.moveRight = this.player.isSprinting = false; }
  _resume() { if (this.state !== 'PAUSED') return; document.getElementById('pause-screen').classList.add('hidden'); this.state = 'PLAYING'; this.clock.start(); this.controls.lock(); }
  _applyBrightness() { if (this.renderer) this.renderer.toneMappingExposure = 0.8 * this.brightness; if (this.world) this.world.setBrightness(this.brightness); }

  // --- Gun System ---
  _shoot() {
    if (this.ammo <= 0 || this.player.isDead) return;
    this.ammo--;
    this.audio.playGunshot();
    this._updateAmmoUI();
    // Raycast from camera center
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const allMeshes = this.allEnemyEntities.filter(e => !e.killed && !e.isDead).map(e => e.mesh);
    const hits = this.raycaster.intersectObjects(allMeshes, true);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      // Find which enemy owns this mesh
      for (const enemy of this.allEnemyEntities) {
        if (enemy.mesh === hitMesh || enemy.mesh === hitMesh.parent || hitMesh.parent?.parent === enemy.mesh) {
          const killed = enemy.takeHit();
          if (killed) {
            if (enemy.isClone) {
              // Find parent Dester and remove clone
              for (const e of this.enemies) { if (e.clones && e.clones.includes(enemy)) { e.removeClone(enemy); break; } }
            }
            this._addChat('', `${enemy.config.name} を撃破した！`, true);
          }
          break;
        }
      }
    }
    // Muzzle flash
    const fl = new THREE.PointLight(0xffaa00, 5, 15);
    fl.position.copy(this.player.position); this.scene.add(fl);
    setTimeout(() => this.scene.remove(fl), 80);
  }
  _updateAmmoUI() {
    const el = document.getElementById('ammo-display');
    if (el) el.textContent = `🔫 ${this.ammo}`;
  }

  // --- Multiplayer ---
  async _openMultiplayer() {
    document.getElementById('title-screen').classList.add('hidden');
    if (!this.lobby) {
      this.lobby = new LobbyUI(this.net);
      this.lobby.onBack = () => { this.menu.showTitle(); this.net.disconnect(); };
      this.lobby.onStartGame = () => this._hostStart();
      this._setupNet();
    }
    this.lobby.show();
    const origC = document.getElementById('create-room-btn');
    const origJ = document.getElementById('join-room-btn');
    [origC, origJ].forEach(btn => {
      const nb = btn.cloneNode(true); btn.parentNode.replaceChild(nb, btn);
      nb.addEventListener('click', async () => {
        const url = document.getElementById('server-url-input').value || 'ws://localhost:8080';
        if (!this.net.connected) { try { await this.net.connect(url); } catch { alert('サーバーに接続できません: ' + url); return; } }
        const name = document.getElementById('player-name-input').value || 'Player';
        this.net.setName(name);
        setTimeout(() => {
          if (nb.id === 'create-room-btn') this.net.createRoom(document.getElementById('room-password-input').value);
          else { const id = document.getElementById('join-room-id').value.toUpperCase(); if (id) this.net.joinRoom(id, document.getElementById('join-room-pw').value); }
        }, 100);
      });
    });
  }

  _setupNet() {
    this.net.on('GAME_START', m => this._onStart(m));
    this.net.on('PLAYER_UPDATE', m => this._onPU(m));
    this.net.on('GAME_STATE', m => this._onGS(m));
    this.net.on('PLAYER_DIED', m => { this.alivePlayers--; this._updateAlive(); this._addChat('', `${m.senderName} が倒された...`, true); const rp = this.remotePlayers.get(m.senderId); if (rp) { rp.isDead = true; rp.mesh.visible = false; } if (this.net.isHost && this.alivePlayers <= 0) { this.net.send({ type: 'GAME_OVER' }); this._gameOver(); } });
    this.net.on('GAME_OVER', () => this._gameOver());
    this.net.on('GAME_CLEAR', () => this._victory());
    this.net.on('CHAT', m => this._addChat(m.sender, m.text));
    this.net.on('PLAYER_LEFT', m => { this._addChat('', `${m.name} が退出しました`, true); const rp = this.remotePlayers.get(m.playerId); if (rp) { rp.dispose(); this.remotePlayers.delete(m.playerId); } });
    this.net.on('PLAYER_REVIVED', m => { const rp = this.remotePlayers.get(m.targetId); if (rp) { rp.isDead = false; rp.mesh.visible = true; } this.alivePlayers++; this._updateAlive(); this._addChat('', `${m.targetName} が復活した！`, true); });
  }

  _hostStart() { this.isMultiplayer = true; this._startGame(true); this.net.startGame({ trees: this.world.getTreePositions(), seed: Math.random() }); }
  _onStart(m) { if (this.net.isHost) return; this.isMultiplayer = true; this.lobby.hide(); this._startGame(true); this.totalPlayers = m.players.length; this.alivePlayers = this.totalPlayers; m.players.forEach(p => { if (p.id !== this.net.playerId) this.remotePlayers.set(p.id, new RemotePlayer(this.scene, p.id, p.name)); }); this._updateAlive(); }
  _onPU(m) { if (!this.net.isHost) return; let rp = this.remotePlayers.get(m.senderId); if (!rp) { rp = new RemotePlayer(this.scene, m.senderId, m.senderName || 'P'); this.remotePlayers.set(m.senderId, rp); } rp.updateFromNetwork(m); }
  _onGS(m) { if (this.net.isHost) return; if (m.enemies) m.enemies.forEach((d, i) => { if (this.enemies[i]) { this.enemies[i].position.set(d.x, 0, d.z); this.enemies[i].mesh.position.copy(this.enemies[i].position); this.enemies[i].state = d.state; } }); if (m.players) m.players.forEach(pd => { if (pd.id === this.net.playerId) return; let rp = this.remotePlayers.get(pd.id); if (!rp) { rp = new RemotePlayer(this.scene, pd.id, pd.name || 'P'); this.remotePlayers.set(pd.id, rp); } rp.updateFromNetwork(pd); }); }

  _enterPortal() {
    if (this.isMultiplayer) { this.playersInPortal.add(this.net.playerId); this.net.send({ type: 'PORTAL_ENTER' }); this.itemSystem.showMessage('ポータルで待機中...'); if (this.net.isHost && this.playersInPortal.size >= this.alivePlayers) { this.net.send({ type: 'GAME_CLEAR' }); this._victory(); } }
    else this._victory();
  }
  _updateAlive() { const el = document.getElementById('alive-counter'); if (this.isMultiplayer) { el.classList.remove('hidden'); document.getElementById('alive-count').textContent = Math.max(0, this.alivePlayers); document.getElementById('total-players').textContent = this.totalPlayers; } }

  // --- Start Game ---
  _startGame(multi) {
    this.isMultiplayer = multi;
    this.audio.init(); if (this.audio.masterGain) this.audio.masterGain.gain.value = this.volume;
    this._clearScene(); this._initScene();
    this.itemSystem = new ItemSystem(this.scene, this.audio);
    this.player = new Player(this.camera);
    this.world = new World(this.scene, this.itemSystem);
    this.world.generate();
    this.flashlight = new Flashlight(this.scene, this.camera);
    this.minimap = new Minimap(this.world.mapSize);
    this.jumpScare = new JumpScare(this.audio, this.scene, this.camera);
    this._spawnEnemies(); this._applyBrightness();
    // Hut wall collision data
    this.hutWalls = [];
    if (this.world.getHuts) this.world.getHuts().forEach(h => { if (h.getWalls) this.hutWalls.push(...h.getWalls()); });
    // Gun: 5% chance
    this.hasGun = Math.random() < 0.05;
    this.ammo = this.hasGun ? 6 : 0;
    // Show/hide gun UI
    let ammoEl = document.getElementById('ammo-display');
    if (!ammoEl) { 
      ammoEl = document.createElement('div'); 
      ammoEl.id = 'ammo-display'; 
      ammoEl.style.cssText = 'position:fixed;bottom:140px;right:40px;font-size:2.5rem;font-weight:bold;color:#ffcc00;z-index:10;text-shadow:2px 2px 4px rgba(0,0,0,0.8);'; 
      document.getElementById('hud').appendChild(ammoEl); 
    }
    ammoEl.style.display = this.hasGun ? 'block' : 'none';
    if (this.hasGun) { this._updateAmmoUI(); this.itemSystem.showMessage('🔫 銃を手に入れた！左クリックで発射'); }
    this.playersInPortal.clear();
    this.remotePlayers.forEach(rp => rp.dispose()); this.remotePlayers.clear();
    if (multi) { document.getElementById('chat-container').classList.remove('hidden'); document.getElementById('alive-counter').classList.remove('hidden'); if (this.net.isHost) { this.totalPlayers = 1; this.alivePlayers = 1; } }
    else document.getElementById('alive-counter').classList.add('hidden');
    // Hide HP bar (instant death mode)
    const hpC = document.getElementById('health-container'); if (hpC) hpC.style.display = 'none';
    this.menu.showGame(); this.hud.updateStamina(100);
    this.hud.clearAll(); this.itemSystem.updateInventoryUI(); this.itemSystem.updateFragmentUI();
    this.controls.lock(); this.state = 'PLAYING'; this.clock.start();
  }

  _spawnEnemies() {
    this.enemies = [];
    const sp = min => { const p = new THREE.Vector3((Math.random()-0.5)*380, 0, (Math.random()-0.5)*380); if (p.length() < min) p.setLength(min); return p; };
    this.enemies.push(new Ember(this.scene, sp(60)));
    this.enemies.push(new Dester(this.scene, sp(60)));
    this.enemies.push(new Runder(this.scene, sp(60)));
  }

  _clearScene() {
    if (this.scene) { while (this.scene.children.length) { const o = this.scene.children[0]; this.scene.remove(o); } }
    this.enemies.forEach(e => e.dispose()); this.enemies = [];
    this.remotePlayers.forEach(rp => rp.dispose()); this.remotePlayers.clear();
    const c = document.getElementById('game-container'); while (c.childNodes.length > 1) c.removeChild(c.lastChild);
    if (!c.contains(this.renderer.domElement)) c.appendChild(this.renderer.domElement);
  }

  // --- Game Loop ---
  _animate() {
    requestAnimationFrame(() => this._animate());
    if (this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    if (this.state !== 'PLAYING') return;
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();
    const playFS = this.player.update(dt, this.world.getTreePositions(), this.hutWalls);
    if (playFS) this.audio.playFootstep();
    this.flashlight.update(dt); this.world.update(time); this.itemSystem.update(time);
    this.remotePlayers.forEach(rp => rp.update(dt));
    if (!this.isMultiplayer || this.net.isHost) this._updateEnemies(dt);
    if (this.isMultiplayer) { this.syncTimer += dt; if (this.syncTimer >= 0.05) { this.syncTimer = 0; this.net.sendPlayerUpdate(this.player.position, this.player.getRotationY(), 100, this.player.isDead); if (this.net.isHost) this._sendGS(); } }
    this.hud.updateStamina(this.player.stamina);
    const ni = this.itemSystem.getNearestItemInfo(this.player.position);
    const np = this.itemSystem.isNearPortal(this.player.position);
    if (np) this.hud.showInteraction('ポータルに入る');
    else if (ni) this.hud.showInteraction(`${ni.icon} ${ni.name}を拾う`);
    else this.hud.hideInteraction();
    if (this.minimap) { const ed = this.allEnemyEntities.map(e => ({ position: e.position, color: e.color || '#ff0000' })); this.minimap.update(dt, this.player.position, this.player.getRotationY(), ed, this.world.getHuts()); }
  }

  _updateEnemies(dt) {
    this.allEnemyEntities = [];
    let closest = Infinity;
    for (const enemy of this.enemies) {
      const r = enemy.update(dt, this.player.position, this.world.getTreePositions());
      if (enemy.getAllEntities) this.allEnemyEntities.push(...enemy.getAllEntities());
      else this.allEnemyEntities.push(enemy);
      if (r === 'ATTACK_HIT' || r === 'CLONE_ATTACK_HIT') {
        // Instant death
        if (this.isMultiplayer) {
          this.net.send({ type: 'PLAYER_DIED' }); this.player.enterSpectatorMode();
          this.renderer.toneMappingExposure = 1.5; this.alivePlayers--; this._updateAlive();
          if (this.alivePlayers <= 0) { this.net.send({ type: 'GAME_OVER' }); this._gameOver(); }
        } else {
          this.player.isDead = true;
          this.jumpScare.trigger(enemy.config.type, () => this._gameOver());
        }
        return;
      }
      const d = enemy.getDistanceTo(this.player.position);
      if (d < closest) closest = d;
      if (enemy.clones) enemy.clones.forEach(c => { const cd = c.getDistanceTo(this.player.position); if (cd < closest) closest = cd; });
    }
    this.audio.updateDissonance(closest);
  }

  _sendGS() {
    const es = this.enemies.map(e => ({ x: e.position.x, z: e.position.z, state: e.state }));
    const ps = []; this.remotePlayers.forEach((rp, id) => ps.push({ id, pos: { x: rp.position.x, y: rp.position.y, z: rp.position.z }, rotY: rp.rotationY, isDead: rp.isDead, name: rp.name }));
    ps.push({ id: this.net.playerId, pos: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z }, rotY: this.player.getRotationY(), isDead: this.player.isDead, name: this.net.playerName });
    this.net.send({ type: 'GAME_STATE', enemies: es, players: ps });
  }

  _useItem(slot) {
    const item = this.itemSystem.useItem(slot);
    if (!item) return;
    switch (item.id) {
      case 'holy_water':
        if (this.isMultiplayer) {
          // Find nearest dead remote player within 10m
          let nearestDead = null, nearDist = 10;
          this.remotePlayers.forEach(rp => { if (rp.isDead) { const d = this.player.position.distanceTo(rp.position); if (d < nearDist) { nearDist = d; nearestDead = rp; } } });
          if (nearestDead) { this.net.send({ type: 'PLAYER_REVIVED', targetId: nearestDead.id, targetName: nearestDead.name }); nearestDead.isDead = false; nearestDead.mesh.visible = true; this.alivePlayers++; this._updateAlive(); this._addChat('', `${nearestDead.name} を復活させた！`, true); }
          else { this.itemSystem.showMessage('近くに死亡した仲間がいません'); this.itemSystem.inventory[slot] = item; this.itemSystem.updateInventoryUI(); }
        } else { this.itemSystem.showMessage('✦ ソロでは聖水の効果はありません'); }
        break;
      case 'flare': this.audio.playFlare(); this.enemies.forEach(e => { if (!e.immuneToFlare) e.stun(item.duration/1000); }); this.hud.addStatusEffect('flare','🔥 照明弾','status-speed',item.duration); this._flash(); break;
      case 'rocket_firework': this.player.activateSpeedBoost(item.speedMultiplier, item.duration); this.hud.addStatusEffect('speed','🚀 加速','status-speed',item.duration); break;
      case 'battery': this.flashlight.rechargeBattery(50); this.itemSystem.showMessage('🔋 バッテリーを補充した'); break;
      case 'radar': if (this.minimap) { this.minimap.activateRadar(item.duration); this.hud.addStatusEffect('radar','📡 レーダー','status-radar',item.duration); } break;
      case 'ammo': if (this.hasGun) { this.ammo += item.refillAmount; this._updateAmmoUI(); this.itemSystem.showMessage(`🔫 弾薬+${item.refillAmount} (残り${this.ammo})`); } break;
    }
  }

  _flash() { const fl = new THREE.PointLight(0xffffff, 10, 100); fl.position.copy(this.player.position); this.scene.add(fl); let i = 10; const f = () => { i -= 0.5; fl.intensity = Math.max(0, i); if (i > 0) requestAnimationFrame(f); else this.scene.remove(fl); }; requestAnimationFrame(f); }
  _gameOver() { this.state = 'GAMEOVER'; this.controls.unlock(); this.menu.showGameOver(); }
  _victory() { this.state = 'VICTORY'; this.controls.unlock(); this.menu.showVictory(); }
}
