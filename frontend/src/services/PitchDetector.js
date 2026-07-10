/* PitchDetector — Web Audio mic capture + autocorrelation pitch detection
   for the Gamer Learn tab. No external libs. */

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const noteFromPitch = (freq) => Math.round(12 * Math.log2(freq / 440)) + 69;
export const freqFromNote = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
export const centsOff = (freq, midi) => Math.floor(1200 * Math.log2(freq / freqFromNote(midi)));
export const noteName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

// Classic ACF pitch estimator (Chris Wilson style)
export function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

  const b = buf.slice(r1, r2);
  SIZE = b.length;
  if (SIZE < 32) return -1;

  const c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE - i; j++)
      c[i] += b[j] * b[j + i];

  let d = 0;
  while (d < SIZE - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  if (maxpos <= 0) return -1;
  let T0 = maxpos;

  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1] ?? x2;
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a) T0 = T0 - bb / (2 * a);

  return sampleRate / T0;
}

export class MicPitchEngine {
  constructor() {
    this.running = false;
    this.ctx = null;
    this.stream = null;
    this.analyser = null;
    this.timer = null;
  }

  ensureCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  async start(onPitch) {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = this.ensureCtx();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    const buf = new Float32Array(this.analyser.fftSize);
    this.running = true;

    const loop = () => {
      if (!this.running) return;
      this.analyser.getFloatTimeDomainData(buf);
      const freq = autoCorrelate(buf, ctx.sampleRate);
      if (freq > 40 && freq < 2200) {
        const midi = noteFromPitch(freq);
        onPitch({ freq, midi, cents: centsOff(freq, midi) });
      } else {
        onPitch(null);
      }
      this.timer = setTimeout(loop, 60);
    };
    loop();
  }

  // Reference tone playback ("Hear it" aid)
  playTone(midi, duration = 0.9) {
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freqFromNote(midi);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  stopMic() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    this.analyser = null;
  }

  destroy() {
    this.stopMic();
    if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; }
  }
}
