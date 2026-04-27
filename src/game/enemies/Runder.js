import * as THREE from 'three';
import { EnemyBase } from './EnemyBase.js';

/**
 * Runder - Blind enemy with echolocation (speaker face, wide detection)
 * Immune to flares.
 */
export class Runder extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, {
      speed: 4,
      chaseSpeed: 5,
      detectionRange: 25,   // halved from 50
      attackRange: 2.5,
      attackDamage: 35,
      attackCooldown: 1.8,
      maxStamina: 150,
      staminaDrain: 10,
      staminaRegen: 25,
      color: '#00aaff',
      name: 'Runder',
      type: 'runder',
    });
    this.sonarPulses = [];
    this.sonarTimer = 0;
    this.sonarInterval = 2.5;
    this.immuneToFlare = true;
    this._removeEyes();
    this._addSpeakerFace();
  }

  _removeEyes() {
    // Hide eye sockets and pupils (indices 2-5)
    for (let i = 2; i <= 5; i++) {
      if (this.mesh.children[i]) this.mesh.children[i].visible = false;
    }
  }

  _addSpeakerFace() {
    // Speaker cone on face - concentric rings
    const speakerMat = new THREE.MeshStandardMaterial({
      color: 0x003355, emissive: 0x00aaff, emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.8,
    });

    // Outer ring
    const outerGeo = new THREE.TorusGeometry(0.22, 0.03, 8, 16);
    const outer = new THREE.Mesh(outerGeo, speakerMat);
    outer.position.set(0, 2.22, 0.28);
    outer.rotation.x = Math.PI / 2;
    this.mesh.add(outer);

    // Middle ring
    const midGeo = new THREE.TorusGeometry(0.14, 0.025, 8, 16);
    const mid = new THREE.Mesh(midGeo, speakerMat);
    mid.position.set(0, 2.22, 0.29);
    mid.rotation.x = Math.PI / 2;
    this.mesh.add(mid);

    // Center dome (speaker cone center)
    const centerGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x00ccff, emissive: 0x00aaff, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.9,
    });
    const center = new THREE.Mesh(centerGeo, centerMat);
    center.position.set(0, 2.22, 0.32);
    this.mesh.add(center);

    // Speaker grille lines
    const grilleMat = new THREE.MeshBasicMaterial({ color: 0x002244 });
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BoxGeometry(0.4, 0.01, 0.01);
      const line = new THREE.Mesh(geo, grilleMat);
      line.position.set(0, 2.12 + i * 0.07, 0.31);
      this.mesh.add(line);
    }
  }

  update(deltaTime, playerPosition, trees) {
    const result = super.update(deltaTime, playerPosition, trees);

    // Animate speaker center (pulsing)
    const speakerCenter = this.mesh.children[12]; // center dome
    if (speakerCenter) {
      const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.15;
      speakerCenter.scale.set(pulse, pulse, pulse);
    }

    return result;
  }

  stun(duration) { /* Immune to flares */ }
  forceStun(duration) { super.stun(duration); }

  dispose() {
    super.dispose();
  }
}
