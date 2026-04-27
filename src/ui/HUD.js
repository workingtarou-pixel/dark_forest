/**
 * HUD - Manages health, stamina, and status effect displays
 */
export class HUD {
  constructor() {
    this.healthBar = document.getElementById('health-bar');
    this.staminaBar = document.getElementById('stamina-bar');
    this.statusEffects = document.getElementById('status-effects');
    this.interactionPrompt = document.getElementById('interaction-prompt');
    this.promptText = document.getElementById('prompt-text');
    this.activeEffects = new Map();
  }

  updateHealth(value, max = 100) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    this.healthBar.style.width = `${pct}%`;
    if (pct < 30) {
      this.healthBar.style.background = 'linear-gradient(90deg, #880000, #ff0000)';
      this.healthBar.style.boxShadow = '0 0 12px rgba(255, 0, 0, 0.8)';
    } else {
      this.healthBar.style.background = 'linear-gradient(90deg, #aa0000, #ff2222)';
      this.healthBar.style.boxShadow = '0 0 8px rgba(255, 34, 34, 0.5)';
    }
  }

  updateStamina(value, max = 100) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    this.staminaBar.style.width = `${pct}%`;
  }

  showInteraction(text) {
    this.interactionPrompt.classList.remove('hidden');
    this.promptText.textContent = text;
  }

  hideInteraction() {
    this.interactionPrompt.classList.add('hidden');
  }

  addStatusEffect(id, label, cssClass, duration) {
    // Remove existing if any
    this.removeStatusEffect(id);

    const el = document.createElement('div');
    el.className = `status-effect ${cssClass}`;
    el.id = `status-${id}`;
    el.textContent = label;
    this.statusEffects.appendChild(el);

    const timer = setTimeout(() => {
      this.removeStatusEffect(id);
    }, duration);

    this.activeEffects.set(id, { el, timer });
  }

  removeStatusEffect(id) {
    const effect = this.activeEffects.get(id);
    if (effect) {
      clearTimeout(effect.timer);
      effect.el.remove();
      this.activeEffects.delete(id);
    }
  }

  clearAll() {
    this.activeEffects.forEach((effect, id) => {
      clearTimeout(effect.timer);
      effect.el.remove();
    });
    this.activeEffects.clear();
    this.hideInteraction();
  }
}
