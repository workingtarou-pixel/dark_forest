/**
 * AudioManager - Procedural horror audio using Web Audio API
 * Handles BGM, dissonance, jump scare sounds, and ambient effects
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    this.activeSources = [];
    this.dissonanceNodes = [];
    this.ambienceSource = null;
    this.droneSource = null;
    this.dissonanceIntensity = 0;
    this.targetDissonanceIntensity = 0;
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6;
    this.masterGain.connect(this.ctx.destination);
    this.initialized = true;
    this.startAmbience();
    this.startDrone();
  }

  /** Low ambient drone for background atmosphere */
  startDrone() {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.value = 40;
    osc2.type = 'sine';
    osc2.frequency.value = 42;

    gain.gain.value = 0.06;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();

    this.droneSource = { osc1, osc2, gain, filter };
  }

  /** Wind and nature ambient sounds using noise */
  startAmbience() {
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate filtered noise for wind-like sound
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise approximation
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();

    this.ambienceSource = { source, gain, filter };
  }

  /**
   * Update dissonance based on enemy proximity
   * @param {number} closestEnemyDistance - Distance to the closest enemy
   * @param {number} maxRange - Maximum range for dissonance effect
   */
  updateDissonance(closestEnemyDistance, maxRange = 40) {
    if (!this.initialized) return;

    if (closestEnemyDistance < maxRange) {
      this.targetDissonanceIntensity = 1 - (closestEnemyDistance / maxRange);
    } else {
      this.targetDissonanceIntensity = 0;
    }

    // Smooth transition
    this.dissonanceIntensity += (this.targetDissonanceIntensity - this.dissonanceIntensity) * 0.05;

    if (this.dissonanceIntensity > 0.01 && this.dissonanceNodes.length === 0) {
      this._createDissonanceNodes();
    }

    if (this.dissonanceNodes.length > 0) {
      const intensity = this.dissonanceIntensity;
      this.dissonanceNodes.forEach(node => {
        node.gain.gain.value = intensity * node.maxGain;
      });

      if (this.dissonanceIntensity < 0.005) {
        this._removeDissonanceNodes();
      }
    }
  }

  _createDissonanceNodes() {
    // Tritone intervals (the "devil's interval") for maximum unease
    const frequencies = [
      { freq: 185, type: 'sawtooth', maxGain: 0.04 },
      { freq: 261.63, type: 'sine', maxGain: 0.05 },
      { freq: 369.99, type: 'square', maxGain: 0.02 },
      { freq: 277.18, type: 'sawtooth', maxGain: 0.03 },
      { freq: 146.83, type: 'triangle', maxGain: 0.04 },
    ];

    frequencies.forEach(({ freq, type, maxGain }) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = type;
      osc.frequency.value = freq;

      // Add slow vibrato for creepy effect
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.5 + Math.random() * 2;
      lfoGain.gain.value = freq * 0.03;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      filter.type = 'lowpass';
      filter.frequency.value = 1500;

      gain.gain.value = 0;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start();

      this.dissonanceNodes.push({ osc, gain, filter, lfo, lfoGain, maxGain });
    });
  }

  _removeDissonanceNodes() {
    this.dissonanceNodes.forEach(node => {
      node.osc.stop();
      node.lfo.stop();
      node.osc.disconnect();
      node.lfo.disconnect();
      node.gain.disconnect();
      node.filter.disconnect();
      node.lfoGain.disconnect();
    });
    this.dissonanceNodes = [];
  }

  /** Play jump scare sound - terrifying multi-layer scream */
  playJumpScare() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const dist = this._createDistortion(30);

    // Layer 1: Low growl sweep
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(80, now);
    osc1.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(200, now + 1.2);

    // Layer 2: High scream sweep
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(300, now);
    osc2.frequency.exponentialRampToValueAtTime(1500, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(600, now + 1.0);

    // Layer 3: Mid shriek
    const osc3 = this.ctx.createOscillator();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(150, now);
    osc3.frequency.exponentialRampToValueAtTime(900, now + 0.2);

    // Layer 4: Piercing scream
    const osc4 = this.ctx.createOscillator();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(800, now);
    osc4.frequency.exponentialRampToValueAtTime(2000, now + 0.08);
    osc4.frequency.exponentialRampToValueAtTime(1200, now + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.setValueAtTime(0.5, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

    [osc1, osc2, osc3, osc4].forEach(o => o.connect(dist));
    dist.connect(gain);
    gain.connect(this.masterGain);

    [osc1, osc2, osc3, osc4].forEach(o => { o.start(now); o.stop(now + 1.5); });

    // Noise burst for impact
    this._playNoiseBurst(0.4, 0.6);
    // Second delayed burst
    setTimeout(() => this._playNoiseBurst(0.2, 0.4), 200);
  }

  _createDistortion(amount) {
    const dist = this.ctx.createWaveShaper();
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    dist.curve = curve;
    return dist;
  }

  /** Play gunshot sound */
  playGunshot() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    // Sharp attack noise burst
    this._playNoiseBurst(0.35, 0.12);
    // Low boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.25);
  }

  /** Play item pickup sound */
  playPickup() {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /** Play fragment collect sound - magical chime */
  playFragmentCollect() {
    if (!this.initialized) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.5);
    });
  }

  /** Play item use sound */
  playItemUse() {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.linearRampToValueAtTime(550, now + 0.2);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  /** Play footstep sound */
  playFootstep() {
    if (!this.initialized) return;
    this._playNoiseBurst(0.04, 0.08);
  }

  /** Play damage sound */
  playDamage() {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /** Play flare sound */
  playFlare() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    // Whoosh sound
    const noise = this._createNoiseSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(3000, now + 0.3);
    filter.Q.value = 2;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 1);
  }

  /** Play portal open sound */
  playPortalOpen() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 200 + i * 150;
      gain.gain.setValueAtTime(0, now + i * 0.2);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.2 + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.2);
      osc.stop(now + 3);
    }
  }

  /** Play Runder sonar ping */
  playSonarPing(volume = 0.1) {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  _playNoiseBurst(volume, duration) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  _createNoiseSource() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  dispose() {
    this._removeDissonanceNodes();
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
