/* BeatMap — builds a note map from the ACTUAL song audio so the Guitar Hero
   highway matches the track. Decodes the preview, detects energy onsets, and
   assigns lanes by brightness (zero-crossing rate): bass → lane 0, bright → 3. */

export async function buildBeatMap(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new AC();
  let audio;
  try {
    audio = await decodeCtx.decodeAudioData(buf);
  } finally {
    decodeCtx.close().catch(() => {});
  }
  const data = audio.getChannelData(0);
  const sr = audio.sampleRate;
  const win = Math.floor(sr * 0.05); // 50ms analysis windows

  const energies = [];
  const zcrs = [];
  for (let i = 0; i + win <= data.length; i += win) {
    let e = 0, z = 0;
    for (let j = i; j < i + win; j++) {
      e += data[j] * data[j];
      if (j > i && (data[j] >= 0) !== (data[j - 1] >= 0)) z++;
    }
    energies.push(e / win);
    zcrs.push(z / win);
  }

  // Onset detection: energy flux above a local adaptive threshold
  const notes = [];
  let lastT = -1;
  for (let i = 2; i < energies.length; i++) {
    const start = Math.max(0, i - 20);
    let avg = 0;
    for (let k = start; k < i; k++) avg += energies[k];
    avg /= i - start;
    const flux = energies[i] - energies[i - 1];
    const t = (i * win) / sr;
    if (flux > avg * 0.9 && energies[i] > avg * 1.35 && t - lastT >= 0.18) {
      lastT = t;
      const z = zcrs[i];
      const lane = z < 0.025 ? 0 : z < 0.06 ? 1 : z < 0.12 ? 2 : 3;
      notes.push({ time: t, lane });
    }
  }

  // Estimate BPM from median inter-onset gap, folded into a musical range
  let bpm = 128;
  if (notes.length > 8) {
    const gaps = [];
    for (let i = 1; i < notes.length; i++) gaps.push(notes[i].time - notes[i - 1].time);
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    if (median > 0.1) {
      bpm = 60 / median;
      while (bpm > 180) bpm /= 2;
      while (bpm < 70) bpm *= 2;
      bpm = Math.round(bpm);
    }
  }

  return { notes, duration: audio.duration, bpm };
}
