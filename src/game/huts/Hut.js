import * as THREE from 'three';

/**
 * Hut - Procedurally generated cabin in the forest
 */
export class Hut {
  constructor(scene, position, hasFragment, itemToPlace) {
    this.scene = scene;
    this.position = position.clone();
    this.hasFragment = hasFragment;
    this.itemToPlace = itemToPlace;
    this.visited = false;
    this.x = position.x;
    this.z = position.z;

    this.mesh = this._createHut();
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  _createHut() {
    const group = new THREE.Group();
    const woodColor = 0x3a2510;
    const roofColor = 0x1a1008;
    const woodMat = new THREE.MeshStandardMaterial({
      color: woodColor,
      roughness: 0.9,
      metalness: 0.0,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.95,
    });

    // Floor
    const floorGeo = new THREE.BoxGeometry(5, 0.2, 5);
    const floor = new THREE.Mesh(floorGeo, woodMat);
    floor.position.y = 0.1;
    group.add(floor);

    // Walls
    const wallThick = 0.2;
    const wallHeight = 3;
    const wallMat = woodMat.clone();

    // Back wall
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(5, wallHeight, wallThick),
      wallMat
    );
    backWall.position.set(0, wallHeight / 2, -2.4);
    group.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, wallHeight, 5),
      wallMat
    );
    leftWall.position.set(-2.4, wallHeight / 2, 0);
    group.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, wallHeight, 5),
      wallMat
    );
    rightWall.position.set(2.4, wallHeight / 2, 0);
    group.add(rightWall);

    // Front wall with door opening
    const frontLeft = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, wallHeight, wallThick),
      wallMat
    );
    frontLeft.position.set(-1.75, wallHeight / 2, 2.4);
    group.add(frontLeft);

    const frontRight = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, wallHeight, wallThick),
      wallMat
    );
    frontRight.position.set(1.75, wallHeight / 2, 2.4);
    group.add(frontRight);

    const frontTop = new THREE.Mesh(
      new THREE.BoxGeometry(2, wallHeight - 2.2, wallThick),
      wallMat
    );
    frontTop.position.set(0, wallHeight - 0.4, 2.4);
    group.add(frontTop);

    // Roof
    const roofGeo = new THREE.ConeGeometry(4, 2, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = wallHeight + 1;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Window (back wall)
    const windowGeo = new THREE.PlaneGeometry(1, 0.8);
    const windowMat = new THREE.MeshBasicMaterial({
      color: 0x112233,
      transparent: true,
      opacity: 0.5,
    });
    const windowMesh = new THREE.Mesh(windowGeo, windowMat);
    windowMesh.position.set(0, 1.8, -2.35);
    group.add(windowMesh);

    // Inner dim light
    const innerLight = new THREE.PointLight(0xffaa44, 0.3, 8);
    innerLight.position.set(0, 2, 0);
    group.add(innerLight);

    // If has fragment, add stronger glow
    if (this.hasFragment) {
      const fragLight = new THREE.PointLight(0x66bbff, 0.5, 10);
      fragLight.position.set(0, 1.5, 0);
      group.add(fragLight);
    }

    return group;
  }

  /** Mark as visited */
  markVisited() {
    this.visited = true;
  }

  /** Get bounding box for collision check */
  getBounds() {
    return {
      minX: this.position.x - 3,
      maxX: this.position.x + 3,
      minZ: this.position.z - 3,
      maxZ: this.position.z + 3,
    };
  }

  /** Get wall segments for precise collision */
  getWalls() {
    const x = this.position.x;
    const z = this.position.z;
    const t = 0.4; // wall thickness for collision
    return [
      // Back wall
      { minX: x - 2.5, maxX: x + 2.5, minZ: z - 2.6, maxZ: z - 2.2 },
      // Left wall
      { minX: x - 2.6, maxX: x - 2.2, minZ: z - 2.5, maxZ: z + 2.5 },
      // Right wall
      { minX: x + 2.2, maxX: x + 2.6, minZ: z - 2.5, maxZ: z + 2.5 },
      // Front left
      { minX: x - 2.5, maxX: x - 0.8, minZ: z + 2.2, maxZ: z + 2.6 },
      // Front right
      { minX: x + 0.8, maxX: x + 2.5, minZ: z + 2.2, maxZ: z + 2.6 },
    ];
  }
}
