/**
 * Minimap - Canvas-based minimap with NaN protection
 */
export class Minimap {
  constructor(mapSize) {
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.mapSize = mapSize;
    this.radarActive = false;
    this.radarTimer = 0;
    this.lastRotY = 0; // Fallback for NaN
  }

  activateRadar(duration = 10000) {
    this.radarActive = true;
    this.radarTimer = duration;
  }

  update(deltaTime, playerPos, playerRotY, enemies, huts) {
    // NaN guard - use last valid rotation if current is invalid
    if (!Number.isFinite(playerRotY)) {
      playerRotY = this.lastRotY;
    } else {
      this.lastRotY = playerRotY;
    }

    // Guard against invalid player position
    if (!playerPos || !Number.isFinite(playerPos.x) || !Number.isFinite(playerPos.z)) {
      return;
    }

    if (this.radarActive) {
      this.radarTimer -= deltaTime * 1000;
      if (this.radarTimer <= 0) {
        this.radarActive = false;
        this.radarTimer = 0;
      }
    }

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const viewRange = this.mapSize * 0.15;
    const scale = w / (viewRange * 2);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 10, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, cx, 0, Math.PI * 2);
    ctx.fill();

    // Grid
    ctx.strokeStyle = 'rgba(0, 80, 0, 0.3)';
    ctx.lineWidth = 0.5;
    for (let i = -3; i <= 3; i++) {
      const offset = i * 20 * scale;
      ctx.beginPath(); ctx.moveTo(cx + offset, 0); ctx.lineTo(cx + offset, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy + offset); ctx.lineTo(w, cy + offset); ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-playerRotY);

    // Huts
    if (huts) {
      huts.forEach(hut => {
        const dx = (hut.x - playerPos.x) * scale;
        const dz = (hut.z - playerPos.z) * scale;
        if (Math.sqrt(dx * dx + dz * dz) < cx - 5) {
          ctx.fillStyle = hut.visited ? 'rgba(100,100,100,0.6)' : 'rgba(200,150,50,0.8)';
          ctx.fillRect(dx - 3, dz - 3, 6, 6);
        }
      });
    }

    // Enemies (radar only)
    if (this.radarActive && enemies) {
      enemies.forEach(enemy => {
        const dx = (enemy.position.x - playerPos.x) * scale;
        const dz = (enemy.position.z - playerPos.z) * scale;
        if (Math.sqrt(dx * dx + dz * dz) < cx - 5) {
          ctx.fillStyle = enemy.color || '#ff0000';
          ctx.beginPath(); ctx.arc(dx, dz, 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = enemy.color || '#ff0000';
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
          ctx.beginPath(); ctx.arc(dx, dz, 5, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
    }

    ctx.restore();

    // Player triangle
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx - 3, cy + 3); ctx.lineTo(cx + 3, cy + 3);
    ctx.closePath(); ctx.fill();

    // Border
    ctx.strokeStyle = this.radarActive ? 'rgba(0,255,100,0.6)' : 'rgba(0,100,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, cx - 1, 0, Math.PI * 2); ctx.stroke();

    if (this.radarActive) {
      ctx.fillStyle = '#00ff44'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
      ctx.fillText('RADAR', cx, h - 8);
      const sweep = (Date.now() * 0.003) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,255,100,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * cx, cy + Math.sin(sweep) * cy); ctx.stroke();
    }
  }
}
