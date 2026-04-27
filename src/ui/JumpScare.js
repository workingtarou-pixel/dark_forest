import * as THREE from 'three';

/**
 * JumpScare - True 3D jump scare system
 * Creates a horrifying 3D enemy model that rushes directly into the camera
 */
export class JumpScare {
  constructor(audioManager, scene, camera) {
    this.audio = audioManager;
    this.scene = scene;
    this.camera = camera;
    this.active = false;
    this.mesh = null;
    this.scareLight = null;
  }

  trigger(enemyType, onComplete) {
    if (this.active) return;
    this.active = true;

    this.audio.playJumpScare();

    const dmg = document.getElementById('damage-overlay');
    if (dmg) {
      dmg.classList.add('damaged');
      setTimeout(() => dmg.classList.remove('damaged'), 400);
    }

    const colors = {
      ember:  0xff4400,
      dester: 0x9933ff,
      runder: 0x00aaff,
    };
    const color = colors[enemyType] || colors.ember;

    this._createScareMesh(enemyType, color);

    // Initial position: 3 units in front of the camera
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const startPos = this.camera.position.clone().add(dir.clone().multiplyScalar(3));
    
    // Target position: right in the camera's face (0.4 units away)
    const targetPos = this.camera.position.clone().add(dir.clone().multiplyScalar(0.4));
    
    this.mesh.position.copy(startPos);
    
    // Look exactly at the camera
    this.mesh.lookAt(this.camera.position);

    const startTime = performance.now();
    const duration = 1500; // ms

    const originalCameraPos = this.camera.position.clone();
    const originalFov = this.camera.fov;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing curve: snap forward quickly, then push slowly
      const ease = 1 - Math.pow(1 - progress, 4);

      // Move mesh towards camera
      this.mesh.position.lerpVectors(startPos, targetPos, ease);

      // Violent camera shake
      const shakeAmt = (1 - progress) * 0.3;
      this.camera.position.x = originalCameraPos.x + (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y = originalCameraPos.y + (Math.random() - 0.5) * shakeAmt;
      this.camera.position.z = originalCameraPos.z + (Math.random() - 0.5) * shakeAmt;

      // FOV zoom effect
      this.camera.fov = originalFov - (ease * 20);
      this.camera.updateProjectionMatrix();

      // Mesh animations (arms reaching out, mouth opening)
      if (this.mesh.children[6]) this.mesh.children[6].rotation.x = -Math.PI / 2 - ease; // Left arm
      if (this.mesh.children[7]) this.mesh.children[7].rotation.x = -Math.PI / 2 - ease; // Right arm
      if (this.mesh.userData.mouth) {
        this.mesh.userData.mouth.scale.y = 1 + ease * 3; // Open mouth wide
      }

      // Red flash on the screen overlay via DOM
      if (progress < 0.1) {
        if (dmg) dmg.style.backgroundColor = `rgba(255, 0, 0, ${(0.1 - progress) * 8})`;
      } else {
        if (dmg) dmg.style.backgroundColor = '';
      }

      if (progress >= 1) {
        this._cleanup(originalCameraPos, originalFov);
        if (onComplete) onComplete();
        return;
      }
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }

  _createScareMesh(enemyType, colorHex) {
    this.mesh = new THREE.Group();
    const color = new THREE.Color(colorHex);

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.4, 1.4, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.2, roughness: 0.7,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = -0.5;
    this.mesh.add(body);

    // Head (Bigger for jump scare effect)
    const headGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x050505, roughness: 0.5, metalness: 0.5,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.0;
    this.mesh.add(head);

    if (enemyType !== 'runder') {
      // Deep eye sockets
      const socketGeo = new THREE.SphereGeometry(0.18, 12, 12);
      const socketMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const leftSocket = new THREE.Mesh(socketGeo, socketMat);
      leftSocket.position.set(-0.2, 1.1, 0.4);
      this.mesh.add(leftSocket);
      
      const rightSocket = new THREE.Mesh(socketGeo, socketMat);
      rightSocket.position.set(0.2, 1.1, 0.4);
      this.mesh.add(rightSocket);

      // Glowing pupils
      const pupilGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const pupilMat = new THREE.MeshBasicMaterial({ color: enemyType === 'ember' ? 0xff0000 : 0xaa55ff });
      const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
      leftPupil.position.set(-0.2, 1.1, 0.55);
      this.mesh.add(leftPupil);
      
      const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
      rightPupil.position.set(0.2, 1.1, 0.55);
      this.mesh.add(rightPupil);
    } else {
      // Runder Speaker Face
      const speakerMat = new THREE.MeshStandardMaterial({
        color: 0x003355, emissive: 0x00aaff, emissiveIntensity: 0.5, roughness: 0.4,
      });
      const outerGeo = new THREE.TorusGeometry(0.35, 0.05, 16, 32);
      const outer = new THREE.Mesh(outerGeo, speakerMat);
      outer.position.set(0, 1.05, 0.45);
      outer.rotation.x = Math.PI / 2;
      this.mesh.add(outer);

      const centerGeo = new THREE.SphereGeometry(0.1, 16, 16);
      const centerMat = new THREE.MeshStandardMaterial({
        color: 0x00ccff, emissive: 0x00aaff, emissiveIntensity: 1.0,
      });
      const center = new THREE.Mesh(centerGeo, centerMat);
      center.position.set(0, 1.05, 0.5);
      this.mesh.add(center);
      
      // Dummy objects to keep indexing consistent with left/right arm at [6], [7]
      this.mesh.add(new THREE.Object3D());
      this.mesh.add(new THREE.Object3D());
      this.mesh.add(new THREE.Object3D());
      this.mesh.add(new THREE.Object3D());
    }

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.1, 1.2, 8, 8);
    const armMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.7, 0.2, 0);
    this.mesh.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.7, 0.2, 0);
    this.mesh.add(rightArm);

    // Gaping mouth
    const mouthGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, 0.6, 0.48);
    this.mesh.add(mouth);
    this.mesh.userData.mouth = mouth;

    // Intense dynamic light focused on the jump scare
    this.scareLight = new THREE.PointLight(colorHex, 50, 10);
    this.scareLight.position.set(0, 1, 1.5);
    this.mesh.add(this.scareLight);

    this.scene.add(this.mesh);
  }

  _cleanup(originalCameraPos, originalFov) {
    this.active = false;
    this.camera.position.copy(originalCameraPos);
    this.camera.fov = originalFov;
    this.camera.updateProjectionMatrix();

    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
      this.mesh = null;
    }
  }
}
