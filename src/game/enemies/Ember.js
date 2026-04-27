import * as THREE from 'three';
import { EnemyBase } from './EnemyBase.js';

/**
 * Ember - Fast enemy with low stamina. Burns out quickly.
 */
export class Ember extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, {
      speed: 5,
      chaseSpeed: 9,
      detectionRange: 12,   // halved from 25
      attackRange: 2.5,
      attackDamage: 30,
      attackCooldown: 1.0,
      maxStamina: 60,
      staminaDrain: 25,
      staminaRegen: 8,
      color: '#ff4400',
      name: 'Ember',
      type: 'ember',
    });
    this._addFireEffect();
  }

  _addFireEffect() {
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.SphereGeometry(0.05, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff4400 : 0xff8800 });
      const p = new THREE.Mesh(geo, mat);
      p.position.set((Math.random()-0.5)*0.6, 0.8+Math.random()*1.5, (Math.random()-0.5)*0.6);
      p.userData.particleOffset = Math.random() * Math.PI * 2;
      this.mesh.add(p);
    }
  }

  update(deltaTime, playerPosition, trees) {
    const result = super.update(deltaTime, playerPosition, trees);
    const t = Date.now() * 0.003;
    this.mesh.children.forEach((child, i) => {
      if (i >= 9 && child.userData.particleOffset !== undefined) {
        const off = child.userData.particleOffset;
        child.position.y = 0.8 + Math.sin(t + off) * 0.5 + Math.random() * 0.1;
        child.position.x = Math.sin(t * 1.5 + off) * 0.3;
      }
    });
    const light = this.mesh.children[8];
    if (light && light.isLight) light.intensity = this.state === 'CHASE' ? 1.5 : 0.5;
    return result;
  }
}
