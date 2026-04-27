import * as THREE from 'three';

/**
 * Player - First-person player controller with spectator mode
 */
export class Player {
  constructor(camera) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, 1.7, 0);
    this.velocity = new THREE.Vector3();

    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.speed = 5;
    this.sprintSpeed = 8;
    this.staminaDrain = 20;
    this.staminaRegen = 15;

    this.isInvincible = false;
    this.invincibleTimer = 0;
    this.speedMultiplier = 1;
    this.speedBoostTimer = 0;
    this.isDead = false;
    this.isSpectator = false;

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isSprinting = false;

    this.footstepTimer = 0;
    this.footstepInterval = 0.5;

    this.camera.position.copy(this.position);
  }

  handleKeyDown(code) {
    switch (code) {
      case 'KeyW': this.moveForward = true; break;
      case 'KeyS': this.moveBackward = true; break;
      case 'KeyA': this.moveLeft = true; break;
      case 'KeyD': this.moveRight = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.isSprinting = true; break;
    }
  }

  handleKeyUp(code) {
    switch (code) {
      case 'KeyW': this.moveForward = false; break;
      case 'KeyS': this.moveBackward = false; break;
      case 'KeyA': this.moveLeft = false; break;
      case 'KeyD': this.moveRight = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.isSprinting = false; break;
    }
  }

  update(deltaTime, trees, hutWalls) {
    if (this.isSpectator) return this._updateSpectator(deltaTime);
    if (this.isDead) return false;

    if (this.isInvincible) {
      this.invincibleTimer -= deltaTime;
      if (this.invincibleTimer <= 0) this.isInvincible = false;
    }
    if (this.speedMultiplier > 1) {
      this.speedBoostTimer -= deltaTime;
      if (this.speedBoostTimer <= 0) this.speedMultiplier = 1;
    }

    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (this.moveForward) direction.add(forward);
    if (this.moveBackward) direction.sub(forward);
    if (this.moveRight) direction.add(right);
    if (this.moveLeft) direction.sub(right);

    let isMoving = false;
    if (direction.length() > 0) {
      direction.normalize();
      isMoving = true;

      let currentSpeed = this.speed;
      if (this.isSprinting && this.stamina > 0) {
        currentSpeed = this.sprintSpeed;
        this.stamina -= this.staminaDrain * deltaTime;
        if (this.stamina <= 0) { this.stamina = 0; this.isSprinting = false; }
      }

      currentSpeed *= this.speedMultiplier;
      const movement = direction.multiplyScalar(currentSpeed * deltaTime);
      const newPos = this.position.clone().add(movement);

      let blocked = false;
      if (trees) {
        for (const tree of trees) {
          const dx = newPos.x - tree.x;
          const dz = newPos.z - tree.z;
          if (Math.sqrt(dx * dx + dz * dz) < 0.8) { blocked = true; break; }
        }
      }

      // Hut wall collision
      if (!blocked && hutWalls) {
        const r = 0.3; // player radius
        for (const w of hutWalls) {
          if (newPos.x + r > w.minX && newPos.x - r < w.maxX &&
              newPos.z + r > w.minZ && newPos.z - r < w.maxZ) {
            blocked = true; break;
          }
        }
      }

      const halfMap = 195;
      if (Math.abs(newPos.x) > halfMap || Math.abs(newPos.z) > halfMap) blocked = true;

      if (!blocked) this.position.copy(newPos);

      this.footstepTimer += deltaTime;
      if (this.footstepTimer >= this.footstepInterval / (currentSpeed / this.speed)) {
        this.footstepTimer = 0;
        return true;
      }
    }

    if (!this.isSprinting || !isMoving) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * deltaTime);
    }

    if (isMoving) {
      const bobSpeed = this.isSprinting ? 12 : 8;
      const bobAmount = this.isSprinting ? 0.06 : 0.03;
      this.position.y = 1.7 + Math.sin(Date.now() * 0.001 * bobSpeed) * bobAmount;
    } else {
      this.position.y = 1.7;
    }

    this.camera.position.copy(this.position);
    return false;
  }

  _updateSpectator(deltaTime) {
    // Free-fly camera for spectators
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (this.moveForward) direction.add(forward);
    if (this.moveBackward) direction.sub(forward);
    if (this.moveRight) direction.add(right);
    if (this.moveLeft) direction.sub(right);

    if (direction.length() > 0) {
      direction.normalize();
      const flySpeed = 12;
      this.position.add(direction.multiplyScalar(flySpeed * deltaTime));
    }
    this.camera.position.copy(this.position);
    return false;
  }

  enterSpectatorMode() {
    this.isSpectator = true;
    this.isDead = true;
    document.getElementById('spectator-hud').classList.remove('hidden');
  }

  takeDamage(amount) {
    if (this.isInvincible || this.isDead) return false;
    this.health -= amount;
    const dmg = document.getElementById('damage-overlay');
    dmg.classList.add('damaged');
    setTimeout(() => dmg.classList.remove('damaged'), 400);
    if (this.health <= 0) { this.health = 0; this.isDead = true; return true; }
    return false;
  }

  activateInvincibility(duration) {
    this.isInvincible = true;
    this.invincibleTimer = duration / 1000;
  }

  activateSpeedBoost(multiplier, duration) {
    this.speedMultiplier = multiplier;
    this.speedBoostTimer = duration / 1000;
  }

  getRotationY() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return Math.atan2(dir.x, dir.z);
  }

  reset() {
    this.position.set(0, 1.7, 0);
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.isInvincible = false;
    this.speedMultiplier = 1;
    this.isDead = false;
    this.isSpectator = false;
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isSprinting = false;
    document.getElementById('spectator-hud').classList.add('hidden');
  }
}

/**
 * RemotePlayer - Represents another player in multiplayer
 */
export class RemotePlayer {
  constructor(scene, id, name) {
    this.scene = scene;
    this.id = id;
    this.name = name;
    this.position = new THREE.Vector3(0, 1.7, 0);
    this.targetPosition = new THREE.Vector3(0, 1.7, 0);
    this.rotationY = 0;
    this.targetRotY = 0;
    this.health = 100;
    this.isDead = false;
    this.enteredPortal = false;
    this.mesh = this._createMesh();
    this.scene.add(this.mesh);
  }

  _createMesh() {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 1.0, 4, 6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2244aa, emissive: 0x112244, emissiveIntensity: 0.3, roughness: 0.7,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.1;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xddccbb, roughness: 0.6,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.0;
    group.add(head);

    // Flashlight glow
    const light = new THREE.PointLight(0xffe8cc, 0.5, 10);
    light.position.y = 1.7;
    group.add(light);

    // Name tag
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 128, 42);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = 2.7;
    sprite.scale.set(2, 0.5, 1);
    group.add(sprite);

    return group;
  }

  updateFromNetwork(data) {
    if (data.pos) {
      this.targetPosition.set(data.pos.x, data.pos.y, data.pos.z);
    }
    if (data.rotY !== undefined) this.targetRotY = data.rotY;
    if (data.health !== undefined) this.health = data.health;
    if (data.isDead !== undefined) {
      this.isDead = data.isDead;
      this.mesh.visible = !data.isDead;
    }
  }

  update(deltaTime) {
    // Smooth interpolation
    this.position.lerp(this.targetPosition, Math.min(1, deltaTime * 10));
    this.rotationY += (this.targetRotY - this.rotationY) * Math.min(1, deltaTime * 10);
    this.mesh.position.copy(this.position);
    this.mesh.position.y = 0;
    this.mesh.rotation.y = this.rotationY;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}
