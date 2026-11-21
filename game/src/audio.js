// audio.js — every sound is synthesised in the browser with WebAudio: no audio
// files, no network. Soft steps, a rustle, a lantern chime, an alarm sting and a
// slow night pad that hums under the garden.

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.padNodes = null;
    this.muted = false;
    this.started = false;
  }

  /** Browsers only let sound start after a gesture; call from the first key or click. */
  ensure() {
    if (this.started) {
      if (this.context && this.context.state === 'suspended') void this.context.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.context.destination);
      this.started = true;
      this.startAmbience();
    } catch {
      this.context = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.context.currentTime, 0.05);
    }
  }

  /** A short tone that slides from one pitch to another. */
  tone(freqFrom, freqTo, duration, type, volume, when = 0) {
    if (!this.context || !this.master) return;
    const t0 = this.context.currentTime + when;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  /** A burst of filtered noise: footsteps, rustles, the gate's clunk. */
  noise(duration, filterFreq, volume, when = 0) {
    if (!this.context || !this.master) return;
    const t0 = this.context.currentTime + when;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t0);
  }

  playStep(loud) {
    if (loud) this.noise(0.09, 700, 0.20);
    else this.noise(0.06, 500, 0.08);
  }

  playRustle() {
    this.noise(0.16, 1800, 0.05);
  }

  playPickup() {
    this.tone(880, 880, 0.14, 'sine', 0.16);
    this.tone(1318, 1318, 0.22, 'sine', 0.16, 0.09);
    this.tone(1760, 1760, 0.30, 'sine', 0.10, 0.18);
  }

  playSuspicious() {
    this.tone(392, 370, 0.18, 'triangle', 0.14);
  }

  playSpotted() {
    this.tone(220, 440, 0.16, 'sawtooth', 0.14);
    this.tone(440, 660, 0.22, 'sawtooth', 0.12, 0.12);
    this.noise(0.25, 2400, 0.06, 0.05);
  }

  playPebble() {
    this.noise(0.05, 3200, 0.16);
    this.noise(0.05, 2600, 0.12, 0.14);
  }

  playCaught() {
    this.tone(160, 55, 0.5, 'sawtooth', 0.22);
    this.noise(0.3, 300, 0.2);
  }

  playWin() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => this.tone(freq, freq, 0.5, 'sine', 0.14, i * 0.13));
  }

  playLose() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) => this.tone(freq, freq * 0.94, 0.45, 'triangle', 0.14, i * 0.2));
  }

  /** The night itself: two slow detuned sines and a faint high shimmer. */
  startAmbience() {
    if (!this.context || !this.master || this.padNodes) return;
    const gain = this.context.createGain();
    gain.gain.value = 0.05;
    gain.connect(this.master);
    const oscA = this.context.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 110;
    const oscB = this.context.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 110.7;
    const oscC = this.context.createOscillator();
    oscC.type = 'triangle';
    oscC.frequency.value = 220.3;
    const shimmerGain = this.context.createGain();
    shimmerGain.gain.value = 0.25;
    const lfo = this.context.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(gain);
    oscB.connect(gain);
    oscC.connect(shimmerGain);
    shimmerGain.connect(gain);
    oscA.start();
    oscB.start();
    oscC.start();
    lfo.start();
    this.padNodes = { oscA, oscB, oscC, lfo };
  }
}
