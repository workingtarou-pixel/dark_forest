import * as THREE from 'three';
import { EnemyBase } from './EnemyBase.js';

/**
 * Dester - Slow enemy that creates up to 2 clones
 */
export class Dester extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, {
      speed: 3,
      chaseSpeed: 3.5,
      detectionRange: 12,   // halved from 25
      attackRange: 2.5,
      attackDamage: 20,
      attackCooldown: 2.0,
      maxStamina: 120,
      staminaDrain: 8,
      staminaRegen: 15,
      color: '#9933ff',
      name: 'Dester',
      type: 'dester',
    });
    this.clones = [];
    this.maxClones = 2;
    this.cloneDrainRate = 12;
    this.cloneSpawnCooldown = 0;
  }

  update(deltaTime, playerPosition, trees) {
    const result = super.update(deltaTime, playerPosition, trees);
    this.cloneSpawnCooldown = Math.max(0, this.cloneSpawnCooldown - deltaTime);

    if (this.state === 'CHASE' && this.clones.length < this.maxClones &&
        this.stamina > 40 && this.cloneSpawnCooldown <= 0) {
      this._spawnClone(playerPosition);
      this.cloneSpawnCooldown = 5;
    }

    const cloneDrain = this.clones.length * this.cloneDrainRate * deltaTime;
    this.stamina = Math.max(0, this.stamina - cloneDrain);
    if (this.stamina <= 0 && this.clones.length > 0) this._removeAllClones();

    for (let i = this.clones.length - 1; i >= 0; i--) {
      const cloneResult = this.clones[i].update(deltaTime, playerPosition, trees);
      if (cloneResult === 'ATTACK_HIT') return 'CLONE_ATTACK_HIT';
    }

    if (this.mesh.children[0] && this.mesh.children[0].material) {
      this.mesh.children[0].material.transparent = true;
      this.mesh.children[0].material.opacity = 0.7 + Math.sin(Date.now() * 0.003) * 0.2;
    }
    return result;
  }

  _spawnClone(playerPosition) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 5;
    const clonePos = new THREE.Vector3(
      this.position.x + Math.cos(angle) * dist, 0,
      this.position.z + Math.sin(angle) * dist
    );
    const clone = new EnemyBase(this.scene, clonePos, {
      speed: this.config.speed * 0.8, chaseSpeed: this.config.chaseSpeed * 0.8,
      detectionRange: this.config.detectionRange, attackRange: this.config.attackRange,
      attackDamage: this.config.attackDamage * 0.5, attackCooldown: 2.5,
      maxStamina: 9999, staminaDrain: 0, staminaRegen: 0,
      color: '#6622aa', name: 'Dester Clone', type: 'dester',
    });
    clone.isClone = true;
    clone.hitsToKill = 1; // Clones die in 1 shot
    clone.state = 'CHASE';
    clone.mesh.traverse(c => { if (c.material) { c.material.transparent = true; c.material.opacity = 0.5; } });
    this.clones.push(clone);
  }

  removeClone(clone) {
    const idx = this.clones.indexOf(clone);
    if (idx !== -1) { this.clones.splice(idx, 1); clone.dispose(); }
  }

  _removeAllClones() { this.clones.forEach(c => c.dispose()); this.clones = []; }
  stun(d) { super.stun(d); this.clones.forEach(c => c.stun(d)); }
  getAllEntities() { return [this, ...this.clones]; }
  dispose() { this._removeAllClones(); super.dispose(); }
}
