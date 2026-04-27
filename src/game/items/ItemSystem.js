import * as THREE from 'three';
import { ITEM_TYPES, SPECIAL_ITEMS, getRandomItemType } from './ItemTypes.js';

/**
 * ItemSystem - Manages item spawning, pickup, and inventory
 */
export class ItemSystem {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audio = audioManager;
    this.worldItems = []; // Items placed in the world
    this.inventory = new Array(5).fill(null); // 5 item slots
    this.fragmentCount = 0;
    this.hasLightOrb = false;
    this.portalCreated = false;
    this.portalMesh = null;
    this.portalPosition = null;
  }

  /**
   * Create a 3D item mesh in the world
   */
  createItemMesh(itemType, position) {
    const group = new THREE.Group();

    // Floating item body
    const geo = new THREE.OctahedronGeometry(0.3, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(itemType.color),
      emissive: new THREE.Color(itemType.color),
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // Point light glow
    const light = new THREE.PointLight(itemType.color, 0.8, 8);
    light.position.y = 0.5;
    group.add(light);

    // Particle ring
    const ringGeo = new THREE.RingGeometry(0.4, 0.5, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: itemType.color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.3;
    group.add(ring);

    group.position.copy(position);
    group.position.y = 1.0;

    group.userData = {
      itemType,
      isItem: true,
      bobOffset: Math.random() * Math.PI * 2,
      ring,
    };

    this.scene.add(group);
    this.worldItems.push(group);
    return group;
  }

  /**
   * Create a light fragment mesh (special glowing appearance)
   */
  createFragmentMesh(position) {
    const group = new THREE.Group();

    // Crystal-like shape
    const geo = new THREE.OctahedronGeometry(0.4, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      emissive: 0xaaddff,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // Strong glow
    const light = new THREE.PointLight(0x66bbff, 2, 15);
    light.position.y = 0.5;
    group.add(light);

    // Outer glow ring
    const ringGeo = new THREE.RingGeometry(0.6, 0.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x66bbff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.3;
    group.add(ring);

    group.position.copy(position);
    group.position.y = 1.2;

    group.userData = {
      itemType: SPECIAL_ITEMS.LIGHT_FRAGMENT,
      isItem: true,
      isFragment: true,
      bobOffset: Math.random() * Math.PI * 2,
      ring,
    };

    this.scene.add(group);
    this.worldItems.push(group);
    return group;
  }

  /**
   * Try to pick up the nearest item
   * @returns {boolean} Whether an item was picked up
   */
  tryPickup(playerPosition, hasGun = false) {
    const pickupRange = 3;
    let closestItem = null;
    let closestDist = pickupRange;

    for (const item of this.worldItems) {
      const dist = playerPosition.distanceTo(item.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }
    }

    if (!closestItem) return false;

    const itemData = closestItem.userData;

    if (itemData.isFragment) {
      // Pick up fragment
      this.fragmentCount++;
      this._removeWorldItem(closestItem);
      this.audio.playFragmentCollect();

      if (this.fragmentCount >= 3) {
        this.hasLightOrb = true;
        this.showMessage('✦ 光の玉が完成した！Qキーでポータルを生成');
      } else {
        this.showMessage(`✦ 光の欠片を手に入れた (${this.fragmentCount}/3)`);
      }
      this.updateFragmentUI();
      return true;
    }

    // If player has a gun, they can only pick up AMMO
    if (hasGun && itemData.itemType.id !== 'ammo') {
      this.showMessage('銃モード中は他のアイテムを拾えません');
      return false;
    }

    // Regular item - find empty slot
    const emptySlot = this.inventory.indexOf(null);
    if (emptySlot === -1) {
      this.showMessage('アイテムスロットが満杯です');
      return false;
    }

    this.inventory[emptySlot] = itemData.itemType;
    this._removeWorldItem(closestItem);
    this.audio.playPickup();
    this.showMessage(`${itemData.itemType.icon} ${itemData.itemType.name}を手に入れた`);
    this.updateInventoryUI();
    return true;
  }

  /**
   * Use item in the specified slot
   * @returns {object|null} The used item type, or null if slot is empty
   */
  useItem(slotIndex) {
    if (slotIndex < 0 || slotIndex >= 5) return null;
    const item = this.inventory[slotIndex];
    if (!item) return null;

    this.inventory[slotIndex] = null;
    this.audio.playItemUse();
    this.showMessage(`${item.icon} ${item.name}を使用した`);
    this.updateInventoryUI();
    return item;
  }

  /**
   * Create an escape portal at the given position
   */
  createPortal(position) {
    if (!this.hasLightOrb || this.portalCreated) return false;

    this.hasLightOrb = false;
    this.portalCreated = true;

    const group = new THREE.Group();

    // Portal ring
    const torusGeo = new THREE.TorusGeometry(2, 0.3, 16, 32);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0x66bbff,
      emissive: 0x66bbff,
      emissiveIntensity: 1,
      metalness: 0.9,
      roughness: 0.1,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    group.add(torus);

    // Portal inner surface
    const portalGeo = new THREE.CircleGeometry(2, 32);
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const portalInner = new THREE.Mesh(portalGeo, portalMat);
    group.add(portalInner);

    // Strong light
    const light = new THREE.PointLight(0x66bbff, 5, 30);
    group.add(light);

    group.position.set(position.x, 2.5, position.z);
    group.userData = { isPortal: true, portalInner, torus };

    this.scene.add(group);
    this.portalMesh = group;
    this.portalPosition = group.position.clone();

    this.audio.playPortalOpen();
    this.showMessage('🌀 ポータルが開いた！Rキーで入れ');

    return true;
  }

  /**
   * Check if player is near the portal
   */
  isNearPortal(playerPosition) {
    if (!this.portalCreated || !this.portalPosition) return false;
    return playerPosition.distanceTo(this.portalPosition) < 3;
  }

  /**
   * Get nearest item info for interaction prompt
   */
  getNearestItemInfo(playerPosition) {
    const pickupRange = 3;
    let closestItem = null;
    let closestDist = pickupRange;

    for (const item of this.worldItems) {
      const dist = playerPosition.distanceTo(item.position);
      if (dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }
    }

    if (!closestItem) return null;

    const data = closestItem.userData;
    return {
      name: data.itemType.name,
      icon: data.itemType.icon,
      isFragment: data.isFragment || false,
    };
  }

  /**
   * Update floating animation for items
   */
  update(time) {
    for (const item of this.worldItems) {
      const bob = item.userData.bobOffset || 0;
      item.position.y = 1.0 + Math.sin(time * 2 + bob) * 0.2;
      item.children[0].rotation.y = time * 1.5 + bob;
      if (item.userData.ring) {
        item.userData.ring.rotation.z = time * 0.5;
      }
    }

    // Animate portal
    if (this.portalMesh) {
      const pd = this.portalMesh.userData;
      pd.torus.rotation.z = time * 0.8;
      pd.torus.rotation.x = Math.sin(time * 0.3) * 0.2;
      pd.portalInner.material.opacity = 0.3 + Math.sin(time * 3) * 0.2;
    }
  }

  _removeWorldItem(item) {
    const idx = this.worldItems.indexOf(item);
    if (idx !== -1) this.worldItems.splice(idx, 1);
    this.scene.remove(item);
    // Deferred disposal to avoid frame drop
    const doDispose = () => {
      item.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(doDispose);
    } else {
      setTimeout(doDispose, 0);
    }
  }

  updateFragmentUI() {
    const counter = document.getElementById('fragment-count');
    if (counter) counter.textContent = this.fragmentCount;
  }

  updateInventoryUI() {
    const slots = document.querySelectorAll('.item-slot');
    slots.forEach((slot, i) => {
      const item = this.inventory[i];
      const icon = slot.querySelector('.slot-icon');
      const name = slot.querySelector('.slot-name');
      if (item) {
        icon.textContent = item.icon;
        name.textContent = item.name;
        slot.classList.add('has-item');
      } else {
        icon.textContent = '';
        name.textContent = '';
        slot.classList.remove('has-item');
      }
    });
  }

  showMessage(text) {
    const log = document.getElementById('message-log');
    if (!log) return;
    const msg = document.createElement('div');
    msg.className = 'log-message';
    msg.textContent = text;
    log.appendChild(msg);

    // Auto remove after 4 seconds
    setTimeout(() => {
      msg.classList.add('fading');
      setTimeout(() => msg.remove(), 500);
    }, 4000);

    // Limit to 5 messages
    while (log.children.length > 5) {
      log.firstChild.remove();
    }
  }
}
