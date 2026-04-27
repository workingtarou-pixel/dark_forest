import * as THREE from 'three';

/**
 * EnemyBase - Base class for all enemies
 * Supports: kill (3 hits), respawn (20s), teleport
 */
export class EnemyBase {
  constructor(scene, position, config) {
    this.scene = scene;
    this.config = config;
    this.position = position.clone();
    this.spawnPosition = position.clone();
    this.state = 'PATROL';
    this.stamina = this.config.maxStamina;
    this.attackTimer = 0;
    this.stateTimer = 0;
    this.patrolTarget = this._randomPatrolTarget();
    this.stunned = false;
    this.stunTimer = 0;
    this.color = this.config.color;
    this.isDead = false;
    this.isClone = false;
    this.lostPlayerTimer = 0;
    this.teleportCooldown = 30;

    // Kill/respawn system
    this.hitCount = 0;
    this.hitsToKill = 3;
    this.killed = false;
    this.respawnTimer = 0;
    this.respawnDelay = 20;

    this.mesh = this._createMesh();
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  _createMesh() {
    const group = new THREE.Group();
    const color = new THREE.Color(this.config.color);

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.15, roughness: 0.8, metalness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.1;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x111111, roughness: 0.6, metalness: 0.3,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.2;
    group.add(head);

    // Eye sockets (black)
    const socketGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const socketMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1 });
    const leftSocket = new THREE.Mesh(socketGeo, socketMat);
    leftSocket.position.set(-0.12, 2.25, 0.22);
    group.add(leftSocket);
    const rightSocket = new THREE.Mesh(socketGeo, socketMat);
    rightSocket.position.set(0.12, 2.25, 0.22);
    group.add(rightSocket);

    // Tiny red pupils
    const pupilGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(-0.12, 2.25, 0.3);
    group.add(leftPupil);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0.12, 2.25, 0.3);
    group.add(rightPupil);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.08, 0.8, 3, 4);
    const armMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.5, 1.4, 0);
    leftArm.rotation.z = 0.3;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.5, 1.4, 0);
    rightArm.rotation.z = -0.3;
    group.add(rightArm);

    // Glow
    const light = new THREE.PointLight(this.config.color, 0.5, 10);
    light.position.y = 1.5;
    group.add(light);

    return group;
  }

  update(deltaTime, playerPosition, trees) {
    if (this.isDead || this.killed) {
      if (this.killed) {
        this.respawnTimer -= deltaTime;
        if (this.respawnTimer <= 0) this._respawn();
      }
      return;
    }

    this.attackTimer = Math.max(0, this.attackTimer - deltaTime);
    this.stamina = Math.min(this.config.maxStamina, this.stamina + this.config.staminaRegen * deltaTime);

    if (this.stunned) {
      this.stunTimer -= deltaTime;
      if (this.stunTimer <= 0) this.stunned = false;
      return;
    }

    const distToPlayer = this.position.distanceTo(playerPosition);
    const canDetect = this._canDetectPlayer(distToPlayer, playerPosition);

    switch (this.state) {
      case 'PATROL':
        this._patrol(deltaTime, canDetect, trees);
        if (canDetect) { this.state = 'CHASE'; this.lostPlayerTimer = 0; }
        else {
          this.lostPlayerTimer += deltaTime;
          if (this.lostPlayerTimer >= this.teleportCooldown && !this.isClone) {
            this._teleportNearPlayer(playerPosition);
            this.lostPlayerTimer = 0;
          }
        }
        break;
      case 'CHASE':
        this._chase(deltaTime, playerPosition, trees);
        if (distToPlayer <= this.config.attackRange) this.state = 'ATTACK';
        else if (!canDetect && distToPlayer > this.config.detectionRange * 1.5) {
          this.state = 'PATROL';
          this.patrolTarget = this._randomPatrolTarget();
        }
        this.stamina -= this.config.staminaDrain * deltaTime;
        if (this.stamina <= 0) { this.stamina = 0; this.state = 'EXHAUSTED'; this.stateTimer = 3; }
        break;
      case 'ATTACK':
        if (this.attackTimer <= 0 && distToPlayer <= this.config.attackRange) {
          this.attackTimer = this.config.attackCooldown;
          return 'ATTACK_HIT';
        }
        if (distToPlayer > this.config.attackRange) this.state = 'CHASE';
        break;
      case 'EXHAUSTED':
        this.stateTimer -= deltaTime;
        this.stamina += this.config.staminaRegen * 2 * deltaTime;
        if (this.stamina >= this.config.maxStamina * 0.6 || this.stateTimer <= 0) {
          this.stamina = Math.min(this.stamina, this.config.maxStamina);
          this.state = canDetect ? 'CHASE' : 'PATROL';
          this.patrolTarget = this._randomPatrolTarget();
        }
        break;
    }

    // Arm animation
    const armSwing = Math.sin(Date.now() * 0.005) * 0.3;
    if (this.mesh.children[6]) this.mesh.children[6].rotation.x = this.state === 'CHASE' ? armSwing : 0;
    if (this.mesh.children[7]) this.mesh.children[7].rotation.x = this.state === 'CHASE' ? -armSwing : 0;

    this.mesh.position.copy(this.position);
    this.mesh.position.y = 0;
  }

  takeHit() {
    if (this.killed || this.isDead) return false;
    this.hitCount++;
    // Flash white briefly
    if (this.mesh.children[0]) {
      const mat = this.mesh.children[0].material;
      const origColor = mat.color.clone();
      mat.color.set(0xffffff);
      setTimeout(() => mat.color.copy(origColor), 150);
    }
    if (this.hitCount >= this.hitsToKill) {
      this._kill();
      return true;
    }
    return false;
  }

  _kill() {
    this.killed = true;
    this.respawnTimer = this.respawnDelay;
    this.mesh.visible = false;
    this.state = 'PATROL';
    this.hitCount = 0;
  }

  _respawn() {
    this.killed = false;
    this.hitCount = 0;
    // Respawn at random position far from origin
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 80;
    this.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;
    this.stamina = this.config.maxStamina;
    this.state = 'PATROL';
    this.patrolTarget = this._randomPatrolTarget();
  }

  _canDetectPlayer(distance, playerPos) {
    return distance <= this.config.detectionRange;
  }

  _patrol(deltaTime, canDetect, trees) {
    if (!this.patrolTarget) this.patrolTarget = this._randomPatrolTarget();
    const dir = new THREE.Vector3().subVectors(this.patrolTarget, this.position);
    dir.y = 0;
    if (dir.length() < 2) { this.patrolTarget = this._randomPatrolTarget(); return; }
    dir.normalize();
    const move = dir.multiplyScalar(this.config.speed * deltaTime);
    const newPos = this.position.clone().add(move);
    if (!this._checkTreeCollision(newPos, trees)) {
      this.position.copy(newPos);
      this.mesh.lookAt(this.patrolTarget.x, 0, this.patrolTarget.z);
    } else {
      this.patrolTarget = this._randomPatrolTarget();
    }
  }

  _chase(deltaTime, playerPosition, trees) {
    const dir = new THREE.Vector3().subVectors(playerPosition, this.position);
    dir.y = 0; dir.normalize();
    const move = dir.multiplyScalar(this.config.chaseSpeed * deltaTime);
    const newPos = this.position.clone().add(move);
    if (!this._checkTreeCollision(newPos, trees)) {
      this.position.copy(newPos);
    }
    this.mesh.lookAt(playerPosition.x, 0, playerPosition.z);
  }

  _checkTreeCollision(pos, trees) {
    if (!trees) return false;
    const r = 0.5;
    for (const tree of trees) {
      const dx = pos.x - tree.x, dz = pos.z - tree.z;
      if (Math.sqrt(dx * dx + dz * dz) < r + 0.5) return true;
    }
    return false;
  }

  _randomPatrolTarget() {
    const h = 190;
    return new THREE.Vector3((Math.random() - 0.5) * h * 2, 0, (Math.random() - 0.5) * h * 2);
  }

  _teleportNearPlayer(playerPosition) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 60;
    const h = 190;
    this.position.set(
      Math.max(-h, Math.min(h, playerPosition.x + Math.cos(angle) * dist)), 0,
      Math.max(-h, Math.min(h, playerPosition.z + Math.sin(angle) * dist))
    );
    this.mesh.position.copy(this.position);
    this.patrolTarget = this._randomPatrolTarget();
  }

  getDistanceTo(pos) { return this.position.distanceTo(pos); }

  stun(duration) { this.stunned = true; this.stunTimer = duration; }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (Array.isArray(c.material)) c.material.forEach(m => m.dispose()); else c.material.dispose(); } });
  }
}
