/**
 * SamplerEngine — minimal Web Audio sampler for the Koala-style Studio.
 *
 *  Each "pad" holds an AudioBuffer + per-pad settings (volume, pitch, ADSR,
 *  hi/lo-pass filter, stem routing). play(padId) triggers the buffer through
 *  the live graph. A MediaStreamDestination taps the master output for the
 *  "resample" workflow.
 */

const NUM_PADS = 16;

export class SamplerEngine {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: "interactive" });

    // Stem buses (Drums / Bass / Keys / Vocals). Each pad routes to one.
    this.stems = {
      drums: this._makeStemBus(),
      bass: this._makeStemBus(),
      keys: this._makeStemBus(),
      vocals: this._makeStemBus(),
    };

    // Master gain (after stems, before FX)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    Object.values(this.stems).forEach((b) => b.gain.connect(this.masterGain));

    // Master FX bus
    this.fxInput = this.ctx.createGain();
    this.fxDry = this.ctx.createGain();
    this.fxWet = this.ctx.createGain();
    this.fxDry.gain.value = 1.0;
    this.fxWet.gain.value = 0.0;
    this.masterGain.connect(this.fxInput);
    this.fxInput.connect(this.fxDry).connect(this.ctx.destination);
    this.fxWet.connect(this.ctx.destination);
    this._activeFxNode = null;

    // MediaStreamDestination — used to record the master out (resample).
    this.streamDest = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.streamDest);

    // 16 pads — default-routed by row (Drums / Bass / Keys / Vocals)
    this.pads = Array.from({ length: NUM_PADS }, (_, i) => ({
      id: i,
      label: "",
      buffer: null,
      stem: ["drums", "bass", "keys", "vocals"][Math.floor(i / 4)],
      volume: 0.85,
      pitch: 0,
      adsr: { a: 0.005, d: 0.2, s: 0.8, r: 0.25 },
      filter: { type: "off", freq: 1000, q: 0.7 },
    }));

    this._activeSources = new Map();
  }

  _makeStemBus() {
    const gain = this.ctx.createGain();
    gain.gain.value = 0.85;
    return { gain, muted: false, level: 0.85 };
  }

  // ── Buffers ──────────────────────────────────────────────────────────────

  decodeArrayBuffer(arrayBuffer) {
    // Wrap the legacy callback API so failures never propagate as unhandled
    // rejections — caller checks for null. Modern browsers ALSO return a
    // rejected Promise from decodeAudioData; we swallow that too.
    return new Promise((resolve) => {
      try {
        const p = this.ctx.decodeAudioData(arrayBuffer.slice(0), resolve, () => resolve(null));
        if (p && typeof p.catch === "function") p.catch(() => resolve(null));
      } catch {
        resolve(null);
      }
    });
  }

  async loadBufferIntoPad(padId, arrayBuffer, label = "") {
    const buf = await this.decodeArrayBuffer(arrayBuffer);
    if (!buf) return null;
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
    if (!bus) return;
    bus.level = value;
    if (!bus.muted) bus.gain.gain.value = value;
  }

  setStemMute(stem, muted) {
    const bus = this.stems[stem];
    if (!bus) return;
    bus.muted = muted;
    bus.gain.gain.value = muted ? 0 : bus.level;
  }

  setMasterVolume(value /* 0..1 */) {
    this.masterGain.gain.value = value;
  }

  // ── Pad playback ─────────────────────────────────────────────────────────

  play(padId, opts = {}) {
    const pad = this.pads[padId];
    if (!pad?.buffer) return null;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = pad.buffer;
    src.playbackRate.value = Math.pow(2, pad.pitch / 12);

    const env = this.ctx.createGain();
    const { a, d, s } = pad.adsr;
    const v = pad.volume * (opts.velocity ?? 1);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(v, now + Math.max(0.001, a));
    env.gain.linearRampToValueAtTime(v * s, now + a + d);

    let outNode = env;
    if (pad.filter.type !== "off") {
      const f = this.ctx.createBiquadFilter();
      f.type = pad.filter.type === "lp" ? "lowpass" : "highpass";
      f.frequency.value = pad.filter.freq;
      f.Q.value = pad.filter.q;
      env.connect(f);
      outNode = f;
    }

    const stemBus = this.stems[pad.stem] || this.stems.drums;
    src.connect(env);
    outNode.connect(stemBus.gain);

    const playbackDur = pad.buffer.duration / Math.pow(2, pad.pitch / 12);
    const stopAt = now + playbackDur;
    env.gain.setValueAtTime(env.gain.value, Math.max(now, stopAt - 0.001));
    env.gain.linearRampToValueAtTime(0, stopAt + pad.adsr.r);
    src.start(now);
    src.stop(stopAt + pad.adsr.r + 0.01);

    this._activeSources.set(padId, src);
    src.onended = () => {
      if (this._activeSources.get(padId) === src) this._activeSources.delete(padId);
    };
    return src;
  }

  stop(padId) {
    const src = this._activeSources.get(padId);
    if (src) { try { src.stop(); } catch { /* noop */ } this._activeSources.delete(padId); }
  }

  // ── Auto-chop (transient detection) ──────────────────────────────────────

  autoChop(buffer, maxSlices = NUM_PADS) {
    if (!buffer) return [];
    const sr = buffer.sampleRate;
    const length = buffer.length;
    const channel = buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(0);

    const win = Math.max(1, Math.floor(sr * 0.01)); // 10ms RMS window
    const rms = new Float32Array(Math.ceil(length / win));
    for (let i = 0, j = 0; i < length; i += win, j++) {
      let sum = 0;
      const end = Math.min(i + win, length);
      for (let k = i; k < end; k++) sum += channel[k] * channel[k];
      rms[j] = Math.sqrt(sum / Math.max(1, end - i));
    }

    const peaks = [];
    const minGap = Math.max(1, Math.floor((sr * 0.12) / win)); // 120ms min spacing
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
    if (peaks.length > maxSlices) {
      const evenly = [];
      for (let i = 0; i < maxSlices; i++) evenly.push(peaks[Math.floor((i * peaks.length) / maxSlices)]);
      peaks.length = 0; peaks.push(...evenly);
    }
    peaks.push(length); // sentinel for last slice end

    const slices = [];
    for (let i = 0; i < peaks.length - 1; i++) {
      const startSample = peaks[i];
      const endSample = peaks[i + 1];
      const sliceLen = endSample - startSample;
      if (sliceLen < sr * 0.02) continue; // skip <20ms slivers
      const out = this.ctx.createBuffer(buffer.numberOfChannels, sliceLen, sr);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch).subarray(startSample, endSample);
        out.copyToChannel(data, ch, 0);
      }
      slices.push(out);
    }
    return slices;
  }

  // ── Hold-FX (master insert) ──────────────────────────────────────────────

  setMasterFx(kind /* off|stutter|crush|reverb|delay|pitch */, amount = 0.5) {
    if (this._activeFxNode) {
      try { this._activeFxNode.dispose(); } catch { /* noop */ }
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
      dispose = () => { try { d.disconnect(); fb.disconnect(); } catch {/* noop */} };
    } else if (kind === "reverb") {
      const c = ctx.createConvolver();
      c.buffer = this._impulseBuffer(2.2 + amount * 1.5);
      inputNode = c; outputNode = c;
      dispose = () => { try { c.disconnect(); } catch {/* noop */} };
    } else if (kind === "crush") {
      const ws = ctx.createWaveShaper();
      const samples = 4096; const curve = new Float32Array(samples);
      const bits = Math.max(1.5, 8 - amount * 6);
      const steps = Math.pow(2, bits);
      for (let i = 0; i < samples; i++) {
        const x = (i / samples) * 2 - 1;
        curve[i] = Math.round(x * steps) / steps;
      }
      ws.curve = curve;
      inputNode = ws; outputNode = ws;
      dispose = () => { try { ws.disconnect(); } catch {/* noop */} };
    } else if (kind === "pitch") {
      // Cheap pitch shimmer via modulated short delay
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.012;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 1.2 + amount * 6;
      lfoGain.gain.value = 0.004 + amount * 0.012;
      lfo.connect(lfoGain).connect(d.delayTime);
      lfo.start();
      inputNode = d; outputNode = d;
      dispose = () => { try { lfo.stop(); lfo.disconnect(); lfoGain.disconnect(); d.disconnect(); } catch {/* noop */} };
    } else if (kind === "stutter") {
      // Square-LFO amplitude gate
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
      dispose = () => { try { lfo.stop(); offset.stop(); stutterGain.disconnect(); scale.disconnect(); } catch {/* noop */} };
    } else {
      return;
    }

    try { this.fxInput.disconnect(this.fxDry); } catch { /* noop */ }
    this.fxInput.connect(this.fxDry);
    this.fxInput.connect(inputNode);
    outputNode.connect(this.fxWet);
    this.fxWet.gain.value = 0.95;
    this.fxDry.gain.value = 0.1;
    this._activeFxNode = { dispose };
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
    try { this.ctx.close(); } catch { /* noop */ }
  }
}

export { NUM_PADS };
