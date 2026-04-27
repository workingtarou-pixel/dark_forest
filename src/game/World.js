import * as THREE from 'three';
import { Hut } from './huts/Hut.js';
import { getRandomItemType } from './items/ItemTypes.js';

/**
 * World - Procedural dark forest generation (optimized with InstancedMesh)
 */
export class World {
  constructor(scene, itemSystem) {
    this.scene = scene;
    this.itemSystem = itemSystem;
    this.mapSize = 400;
    this.treePositions = [];
    this.huts = [];
    this.hutCount = 15;
    this.fragmentHutCount = 3;
    this.fireflies = [];
    this.brightness = 1.0;
    this.ambientLight = null;
    this.moonLight = null;
  }

  generate() {
    this._createGround();
    this._createFog();
    this._createTrees();
    this._createHuts();
    this._createAmbientLighting();
    this._scatterGroundItems();
  }

  setBrightness(value) {
    this.brightness = value;
    if (this.ambientLight) this.ambientLight.intensity = 0.6 * value;
    if (this.moonLight) this.moonLight.intensity = 0.3 * value;
  }

  _createGround() {
    const geo = new THREE.PlaneGeometry(this.mapSize, this.mapSize, 32, 32);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, (Math.sin(pos.getX(i) * 0.05) + Math.cos(pos.getY(i) * 0.07)) * 0.3);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a1a0a,
      roughness: 1,
      metalness: 0,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Reduced undergrowth (50 instead of 200)
    for (let i = 0; i < 50; i++) {
      const patchGeo = new THREE.PlaneGeometry(3 + Math.random() * 5, 3 + Math.random() * 5);
      const patchMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.28, 0.3, 0.03 + Math.random() * 0.03),
        roughness: 1,
        transparent: true,
        opacity: 0.6,
      });
      const patch = new THREE.Mesh(patchGeo, patchMat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(
        (Math.random() - 0.5) * this.mapSize * 0.9,
        0.02,
        (Math.random() - 0.5) * this.mapSize * 0.9
      );
      this.scene.add(patch);
    }
  }

  _createFog() {
    // Reduced fog density for better visibility
    this.scene.fog = new THREE.FogExp2(0x030610, 0.018);
    this.scene.background = new THREE.Color(0x020408);
  }

  _createTrees() {
    const treeCount = 500; // Reduced from 1200
    const halfMap = this.mapSize / 2 - 10;

    // Generate positions first
    const treeData = [];
    let attempts = 0;
    while (treeData.length < treeCount && attempts < treeCount * 3) {
      attempts++;
      const x = (Math.random() - 0.5) * halfMap * 2;
      const z = (Math.random() - 0.5) * halfMap * 2;

      // Don't place near player spawn
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      // Check minimum spacing
      let tooClose = false;
      for (const t of treeData) {
        const dx = x - t.x;
        const dz = z - t.z;
        if (dx * dx + dz * dz < 6) { tooClose = true; break; }
      }
      if (tooClose) continue;

      const scale = 0.7 + Math.random() * 0.6;
      treeData.push({ x, z, scale, rotY: Math.random() * Math.PI * 2 });
      this.treePositions.push({ x, z });
    }

    // InstancedMesh for trunks (1 draw call for all trunks)
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 6, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a0e05, roughness: 1 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeData.length);

    // InstancedMesh for canopies (1 draw call for all canopies)
    const canopyGeo = new THREE.ConeGeometry(2, 5, 5);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0a1a08, roughness: 0.9 });
    const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, treeData.length);

    const dummy = new THREE.Object3D();

    treeData.forEach((tree, i) => {
      // Trunk
      dummy.position.set(tree.x, 3 * tree.scale, tree.z);
      dummy.scale.set(tree.scale, tree.scale, tree.scale);
      dummy.rotation.set(0, tree.rotY, 0);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      // Canopy
      const canopyY = (5.5 + Math.random() * 2.5) * tree.scale;
      const cx = 0.8 + Math.random() * 0.5;
      const cy = 0.8 + Math.random() * 0.4;
      dummy.position.set(tree.x, canopyY, tree.z);
      dummy.scale.set(tree.scale * cx, tree.scale * cy, tree.scale * cx);
      dummy.rotation.set(0, tree.rotY, 0);
      dummy.updateMatrix();
      canopyMesh.setMatrixAt(i, dummy.matrix);
    });

    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;

    this.scene.add(trunkMesh);
    this.scene.add(canopyMesh);
  }

  _createHuts() {
    const halfMap = this.mapSize / 2 - 30;
    const minDist = 35;

    const fragmentIndices = new Set();
    while (fragmentIndices.size < this.fragmentHutCount) {
      fragmentIndices.add(Math.floor(Math.random() * this.hutCount));
    }

    const positions = [];
    let attempts = 0;

    while (positions.length < this.hutCount && attempts < 1000) {
      attempts++;
      const x = (Math.random() - 0.5) * halfMap * 2;
      const z = (Math.random() - 0.5) * halfMap * 2;

      if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;

      let valid = true;
      for (const p of positions) {
        if (Math.sqrt((x - p.x) ** 2 + (z - p.z) ** 2) < minDist) {
          valid = false; break;
        }
      }
      if (valid) {
        for (const tree of this.treePositions) {
          if (Math.sqrt((x - tree.x) ** 2 + (z - tree.z) ** 2) < 6) {
            valid = false; break;
          }
        }
      }
      if (valid) positions.push({ x, z });
    }

    // Remove trees near huts
    this.treePositions = this.treePositions.filter(tree => {
      for (const pos of positions) {
        if (Math.sqrt((tree.x - pos.x) ** 2 + (tree.z - pos.z) ** 2) < 6) return false;
      }
      return true;
    });

    positions.forEach((pos, index) => {
      const hasFragment = fragmentIndices.has(index);
      const itemToPlace = hasFragment ? null : getRandomItemType();

      const hut = new Hut(
        this.scene,
        new THREE.Vector3(pos.x, 0, pos.z),
        hasFragment,
        itemToPlace
      );
      this.huts.push(hut);

      const itemPos = new THREE.Vector3(pos.x, 0, pos.z);
      if (hasFragment) {
        this.itemSystem.createFragmentMesh(itemPos);
      } else if (itemToPlace) {
        this.itemSystem.createItemMesh(itemToPlace, itemPos);
      }
    });
  }

  _createAmbientLighting() {
    // Brighter ambient lighting
    this.ambientLight = new THREE.AmbientLight(0x101830, 0.8);
    this.scene.add(this.ambientLight);

    // Stronger moonlight
    this.moonLight = new THREE.DirectionalLight(0x1a1a40, 0.3);
    this.moonLight.position.set(50, 100, 30);
    this.scene.add(this.moonLight);

    // Fewer fireflies (5 instead of 15), store refs
    for (let i = 0; i < 5; i++) {
      const firefly = new THREE.PointLight(
        Math.random() > 0.5 ? 0x44ff44 : 0xaaff00,
        0.3, 6
      );
      firefly.position.set(
        (Math.random() - 0.5) * this.mapSize * 0.6,
        1 + Math.random() * 3,
        (Math.random() - 0.5) * this.mapSize * 0.6
      );
      firefly.userData.offset = Math.random() * Math.PI * 2;
      this.scene.add(firefly);
      this.fireflies.push(firefly);
    }
  }

  _scatterGroundItems() {
    const halfMap = this.mapSize / 2 - 20;
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * halfMap * 2;
      const z = (Math.random() - 0.5) * halfMap * 2;
      const item = getRandomItemType();
      this.itemSystem.createItemMesh(item, new THREE.Vector3(x, 0, z));
    }
  }

  /** Update fireflies (no scene.traverse needed) */
  update(time) {
    for (const ff of this.fireflies) {
      const o = ff.userData.offset;
      ff.position.y = 1 + Math.sin(time * 0.5 + o) * 2;
      ff.position.x += Math.sin(time * 0.3 + o) * 0.01;
      ff.intensity = 0.15 + Math.sin(time * 2 + o) * 0.15;
    }
  }

  getTreePositions() { return this.treePositions; }
  getHuts() { return this.huts; }
}
