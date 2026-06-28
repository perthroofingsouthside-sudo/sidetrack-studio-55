/**
 * SamplerEngine — minimal Web Audio sampler for the Koala-style Studio.
 *
 *  Each "pad" holds an AudioBuffer + per-pad settings (volume, pitch, ADSR,
 *  hi/lo-pass filter). play(padId) triggers the buffer through the live graph.
 *  Records can also tap the master output via MediaStreamDestination for the
 *  "resample" workflow.
 */

const NUM_PADS = 16;

export class SamplerEngine {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: "interactive" });
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;

    // Stem buses (Drums / Bass / Keys / Master).  Each pad routes to one.
    this.stems = {
      drums: this._makeStemBus(),
      bass: this._makeStemBus(),
      keys: this._makeStemBus(),
      vocals: this._makeStemBus(),
    };
    Object.values(this.stems).forEach((b) => b.out.connect(this.masterGain));

    // Master FX bus (Hold-FX bar plugs in here)
    this.fxInput = this.ctx.createGain();
    this.fxDry = this.ctx.createGain();
    this.fxWet = this.ctx.createGain();
    this.fxDry.gain.value = 1.0;
    this.fxWet.gain.value = 0.0;
    this.masterGain.connect(this.fxInput);
    this.fxInput.connect(this.fxDry).connect(this.ctx.destination);
    this._activeFxNode = null; // currently-engaged FX node
    this.fxWet.connect(this.ctx.destination);

    // MediaStreamDestination — for resample (record master)
    this.streamDest = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.streamDest);

    // Pads (16). Each: { buffer, stem, volume, pitch, adsr, filter }
    this.pads = Array.from({ length: NUM_PADS }, (_, i) => ({
      id: i,
      label: "",                // user-facing name (filled from auto-chop or upload)
      buffer: null,             // AudioBuffer
      stem: ["drums", "bass", "keys", "vocals"][Math.floor(i / 4)], // default routing by row
      volume: 0.85,
      pitch: 0,                 // semitones, -12..+12
      adsr: { a: 0.005, d: 0.2, s: 0.8, r: 0.25 },
      filter: { type: "off", freq: 1000, q: 0.7 }, // off | lp | hp
    }));

    // Currently-playing sources per pad (to allow stop on note-off)
    this._activeSources = new Map();
  }

  _makeStemBus() {
    const gain = this.ctx.createGain();
    gain.gain.value = 0.85;
    return { gain, out: gain, muted: false, solo: false };
  }

  // ── Buffers ──────────────────────────────────────────────────────────────

  async decodeArrayBuffer(arrayBuffer) {
    return new Promise((resolve, reject) => {
      this.ctx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
    });
  }

  async loadBufferIntoPad(padId, arrayBuffer, label = "") {
    const buf = await this.decodeArrayBuffer(arrayBuffer);
    this.pads[padId].buffer = buf;
    if (label) this.pads[padId].label = label;
    return buf;
  }

  setPadBuffer(padId, buffer, label = "") {
    this.pads[padId].buffer = buffer;
    if (label) this.pads[padId].label = label;
  }

  // ── Stem routing / mixing ────────────────────────────────────────────────

  setStemVolume(stem, value /* 0..1 */) {
    const bus = this.stems[stem];
    if (bus) bus.gain.gain.value = value;
  }

  setStemMute(stem, muted) {
    const bus = this.stems[stem];
    if (!bus) return;
    bus.muted = muted;
    bus.gain.gain.value = muted ? 0 : 0.85;
  }

  setMasterVolume(value /* 0..1 */) {
    this.masterGain.gain.value = value;
  }

  // ── Pad playback ─────────────────────────────────────────────────────────

  play(padId, opts = {}) {
    const pad = this.pads[padId];
    if (!pad?.buffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = pad.buffer;
    // Pitch via playbackRate (semitones)
    src.playbackRate.value = Math.pow(2, pad.pitch / 12);

    const env = this.ctx.createGain();
    const { a, d, s, r } = pad.adsr;
    const v = pad.volume * (opts.velocity ?? 1);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(v, now + Math.max(0.001, a));
    env.gain.linearRampToValueAtTime(v * s, now + a + d);

    // Optional per-pad filter
    let node = env;
    if (pad.filter.type !== "off") {
      const f = this.ctx.createBiquadFilter();
      f.type = pad.filter.type === "lp" ? "lowpass" : "highpass";
      f.frequency.value = pad.filter.freq;
      f.Q.value = pad.filter.q;
      env.connect(f);
      node = f;
    }

    // Routing
    const stemBus = this.stems[pad.stem] || this.stems.drums;
    src.connect(env);
    node.connect(stemBus.gain);

    src.start(now);

    // Auto-release at buffer end
    const stopAt = now + pad.buffer.duration / Math.pow(2, pad.pitch / 12);
    src.stop(stopAt + pad.adsr.r);
    env.gain.setValueAtTime(env.gain.value, Math.max(now, stopAt - 0.001));
    env.gain.linearRampToValueAtTime(0, stopAt + pad.adsr.r);

    this._activeSources.set(padId, src);
    src.onended = () => {
      if (this._activeSources.get(padId) === src) this._activeSources.delete(padId);
    };
    return src;
  }

  stop(padId) {
    const src = this._activeSources.get(padId);
    if (src) { try { src.stop(); } catch {} this._activeSources.delete(padId); }
  }

  // ── Auto-chop ────────────────────────────────────────────────────────────

  /**
   * Detect transients in a mono buffer (down-mixed) and return up to N slice
   * AudioBuffers covering the whole sample.
   */
  autoChop(buffer, maxSlices = 16) {
    if (!buffer) return [];
    const sr = buffer.sampleRate;
    const length = buffer.length;
    const channel = buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(0);

    // RMS window
    const win = Math.floor(sr * 0.01); // 10ms
    const rms = new Float32Array(Math.ceil(length / win));
    for (let i = 0, j = 0; i < length; i += win, j++) {
      let sum = 0;
      const end = Math.min(i + win, length);
      for (let k = i; k < end; k++) sum += channel[k] * channel[k];
      rms[j] = Math.sqrt(sum / (end - i));
    }
    // Peak detection on rate-of-change
    const peaks = [];
    const minGap = Math.floor((sr * 0.12) / win); // 120ms min between transients
    let cooldown = 0;
    let dynThresh = 0;
    for (let i = 1; i < rms.length; i++) {
      const delta = rms[i] - rms[i - 1];
      dynThresh = 0.9 * dynThresh + 0.1 * Math.max(0, delta);
      if (cooldown > 0) { cooldown--; continue; }
      if (delta > Math.max(0.015, dynThresh * 2.2)) {
        peaks.push(i * win);
        cooldown = minGap;
      }
    }
    if (peaks.length === 0) peaks.push(0);
    // Cap slices
    if (peaks.length > maxSlices) {
      const step = peaks.length / maxSlices;
      const evenly = [];
      for (let i = 0; i < maxSlices; i++) evenly.push(peaks[Math.floor(i * step)]);
      peaks.length = 0;
      peaks.push(...evenly);
    }
    peaks.push(length); // sentinel for last slice end

    const slices = [];
    for (let i = 0; i < peaks.length - 1; i++) {
      const startSample = peaks[i];
      const endSample = peaks[i + 1];
      const sliceLen = endSample - startSample;
      if (sliceLen < sr * 0.02) continue;
      const out = this.ctx.createBuffer(buffer.numberOfChannels, sliceLen, sr);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch).subarray(startSample, endSample);
        out.copyToChannel(data, ch, 0);
      }
      slices.push(out);
    }
    return slices;
  }

  // ── Hold-FX ──────────────────────────────────────────────────────────────

  setMasterFx(kind /* off | stutter | crush | reverb | delay | pitch */, amount = 0.5) {
    // Disconnect any prior FX node
    if (this._activeFxNode) {
      try { this._activeFxNode.dispose(); } catch {}
      this._activeFxNode = null;
    }
    this.fxDry.gain.value = 1.0;
    this.fxWet.gain.value = 0.0;
    if (kind === "off") return;

    const ctx = this.ctx;
    let inputNode, outputNode, dispose;
    if (kind === "delay") {
      const d = ctx.createDelay(1.5);
      d.delayTime.value = 0.18 + amount * 0.32;
      const fb = ctx.createGain();
      fb.gain.value = 0.35 + amount * 0.4;
      d.connect(fb).connect(d);
      inputNode = d; outputNode = d;
      dispose = () => { try { d.disconnect(); fb.disconnect(); } catch {} };
    } else if (kind === "reverb") {
      const c = ctx.createConvolver();
      c.buffer = this._impulseBuffer(2.2 + amount * 1.5);
      inputNode = c; outputNode = c;
      dispose = () => { try { c.disconnect(); } catch {} };
    } else if (kind === "crush") {
      const ws = ctx.createWaveShaper();
      const samples = 65536; const curve = new Float32Array(samples);
      const bits = Math.max(1.5, 8 - amount * 6);
      const steps = Math.pow(2, bits);
      for (let i = 0; i < samples; i++) {
        const x = (i / samples) * 2 - 1;
        curve[i] = Math.round(x * steps) / steps;
      }
      ws.curve = curve;
      inputNode = ws; outputNode = ws;
      dispose = () => { try { ws.disconnect(); } catch {} };
    } else if (kind === "pitch") {
      // Simple "pitch" via delay modulation chorus/detune-ish (cheap)
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.012;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 1.2 + amount * 6;
      lfoGain.gain.value = 0.004 + amount * 0.012;
      lfo.connect(lfoGain).connect(d.delayTime);
      lfo.start();
      inputNode = d; outputNode = d;
      dispose = () => { try { lfo.stop(); lfo.disconnect(); lfoGain.disconnect(); d.disconnect(); } catch {} };
    } else if (kind === "stutter") {
      // Hard-gated stutter: amplitude LFO at fast rate
      const stutterGain = ctx.createGain();
      stutterGain.gain.value = 1;
      const lfo = ctx.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = 10 + amount * 18;
      const offset = ctx.createConstantSource();
      offset.offset.value = 0.5;
      const scale = ctx.createGain();
      scale.gain.value = 0.5;
      lfo.connect(scale).connect(stutterGain.gain);
      offset.connect(stutterGain.gain);
      lfo.start(); offset.start();
      inputNode = stutterGain; outputNode = stutterGain;
      dispose = () => { try { lfo.stop(); offset.stop(); stutterGain.disconnect(); } catch {} };
    } else {
      return;
    }

    // Patch wet path: fxInput -> inputNode -> outputNode -> fxWet
    try { this.fxInput.disconnect(this.fxDry); } catch {}
    this.fxInput.connect(this.fxDry);
    this.fxInput.connect(inputNode);
    outputNode.connect(this.fxWet);
    this.fxWet.gain.value = 0.95;
    this.fxDry.gain.value = 0.1;
    this._activeFxNode = { inputNode, outputNode, dispose };
  }

  _impulseBuffer(seconds = 2.5) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
    }
    return buf;
  }

  // ── Master record (resample) ─────────────────────────────────────────────

  startMasterRecord() {
    const rec = new MediaRecorder(this.streamDest.stream);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.start();
    return {
      stop: () => new Promise((resolve) => {
        rec.onstop = async () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const ab = await blob.arrayBuffer();
          const buf = await this.decodeArrayBuffer(ab);
          resolve({ blob, buffer: buf });
        };
        rec.stop();
      }),
    };
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  dispose() {
    try { this.ctx.close(); } catch {}
  }
}

export { NUM_PADS };
