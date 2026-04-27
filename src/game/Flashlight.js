import * as THREE from 'three';

/**
 * Flashlight - Enhanced brightness, always-on base light
 */
export class Flashlight {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.isOn = true;
    this.battery = 100;
    this.drainRate = 1.2;
    this.maxBattery = 100;

    // Main spotlight (very bright)
    this.light = new THREE.SpotLight(0xffe8cc, 16, 70, Math.PI / 4.5, 0.35, 1.0);
    this.scene.add(this.light);
    this.scene.add(this.light.target);

    // Fill light
    this.fillLight = new THREE.PointLight(0xffe8cc, 1.5, 22);
    this.scene.add(this.fillLight);

    // Base ambient - ALWAYS on
    this.baseLight = new THREE.PointLight(0x8899bb, 0.8, 15);
    this.scene.add(this.baseLight);
  }

  toggle() {
    if (this.battery <= 0) { this.isOn = false; return; }
    this.isOn = !this.isOn;
    this.light.visible = this.isOn;
    this.fillLight.visible = this.isOn;
  }

  rechargeBattery(amount = 50) {
    this.battery = Math.min(this.maxBattery, this.battery + amount);
    if (this.battery > 0 && !this.isOn) {
      this.isOn = true;
      this.light.visible = true;
      this.fillLight.visible = true;
    }
  }

  update(deltaTime) {
    if (this.isOn && this.battery > 0) {
      this.battery -= this.drainRate * deltaTime;
      if (this.battery <= 0) {
        this.battery = 0;
        this.isOn = false;
        this.light.visible = false;
        this.fillLight.visible = false;
      }
      if (this.battery < 20 && this.battery > 0) {
        const flicker = Math.random() > 0.05 ? 1 : 0;
        this.light.intensity = 16 * flicker * (this.battery / 20);
      } else if (this.battery >= 20) {
        this.light.intensity = 16;
      }
    }

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const camPos = this.camera.position.clone();

    this.light.position.copy(camPos);
    this.light.position.y -= 0.3;
    this.light.target.position.copy(camPos.clone().add(dir.clone().multiplyScalar(20)));
    this.fillLight.position.copy(camPos);
    this.baseLight.position.copy(camPos);

    const bar = document.getElementById('battery-bar');
    if (bar) {
      bar.style.width = `${this.battery}%`;
      bar.style.background = this.battery < 20
        ? 'linear-gradient(90deg, #aa3300, #ff4400)'
        : 'linear-gradient(90deg, #aa7700, #ffcc00)';
    }
  }
}
