/**
 * Audio Utilities
 * Helper functions for audio processing
 */

/**
 * Convert frequency (Hz) to MIDI note number
 */
export function frequencyToMidi(frequency: number): number {
  return Math.round(12 * Math.log2(frequency / 440) + 69);
}

/**
 * Convert MIDI note number to frequency (Hz)
 */
export function midiToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Convert linear volume (0-1) to decibels
 */
export function volumeToDb(volume: number): number {
  if (volume <= 0) return -Infinity;
  return 20 * Math.log10(Math.max(0, Math.min(1, volume)));
}

/**
 * Convert decibels to linear volume (0-1)
 */
export function dbToVolume(db: number): number {
  if (db === -Infinity) return 0;
  return Math.pow(10, db / 20);
}

/**
 * Smooth pitch values using moving average
 */
export function smoothPitch(pitchHistory: number[], windowSize: number = 5): number {
  if (pitchHistory.length === 0) return 0;
  const window = pitchHistory.slice(-windowSize);
  return window.reduce((a, b) => a + b, 0) / window.length;
}

/**
 * Calculate frequency deviation in cents from target
 */
export function getCentDeviation(detectedFreq: number, targetFreq: number): number {
  if (targetFreq <= 0 || detectedFreq <= 0) return 0;
  return 1200 * Math.log2(detectedFreq / targetFreq);
}

/**
 * Check if detected pitch is within tolerance
 */
export function isPitchInTune(
  detectedFreq: number,
  targetFreq: number,
  toleranceCents: number = 50,
): boolean {
  const deviation = Math.abs(getCentDeviation(detectedFreq, targetFreq));
  return deviation <= toleranceCents;
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate RMS (Root Mean Square) amplitude
 */
export function calculateRMS(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
}

/**
 * Convert RMS to dB
 */
export function rmsToDb(rms: number): number {
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

/**
 * Get frequency spectrum from analyser data
 */
export function getFrequencySpectrum(analyser: AnalyserNode): Float32Array {
  const dataArray = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(dataArray);
  return dataArray;
}

/**
 * Get time-domain data from analyser
 */
export function getTimeDomainData(analyser: AnalyserNode): Uint8Array {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  return dataArray;
}

/**
 * Find peak frequency in spectrum
 */
export function findPeakFrequency(analyser: AnalyserNode): number {
  const spectrum = getFrequencySpectrum(analyser);
  let maxValue = -Infinity;
  let maxIndex = 0;

  for (let i = 0; i < spectrum.length; i++) {
    if (spectrum[i] > maxValue) {
      maxValue = spectrum[i];
      maxIndex = i;
    }
  }

  // Convert bin index to frequency
  const nyquistFrequency = analyser.context.sampleRate / 2;
  return (maxIndex * nyquistFrequency) / spectrum.length;
}

/**
 * Calculate audio level (0-100)
 */
export function calculateLevel(analyser: AnalyserNode): number {
  const data = getTimeDomainData(analyser);
  let max = 0;

  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - 128) / 128;
    max = Math.max(max, Math.abs(normalized));
  }

  return Math.round(max * 100);
}

/**
 * Exponential smoothing
 */
export function exponentialSmoothing(
  current: number,
  previous: number,
  smoothingFactor: number = 0.2,
): number {
  return smoothingFactor * current + (1 - smoothingFactor) * previous;
}

/**
 * Format time in seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calculate note accuracy percentage
 */
export function calculateAccuracy(
  detectedFreq: number,
  targetFreq: number,
  toleranceCents: number = 50,
): number {
  const deviation = Math.abs(getCentDeviation(detectedFreq, targetFreq));
  if (deviation > toleranceCents) return 0;
  return Math.max(0, 100 * (1 - deviation / toleranceCents));
}

/**
 * Get note name from MIDI number
 */
export function getMidiNoteName(note: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const noteName = noteNames[note % 12];
  return `${noteName}${octave}`;
}

/**
 * Check if two frequencies are within an octave
 */
export function isSameNote(freq1: number, freq2: number, tolerance: number = 50): boolean {
  return (
    isPitchInTune(freq1, freq2, tolerance) ||
    isPitchInTune(freq1, freq2 * 2, tolerance) ||
    isPitchInTune(freq1, freq2 / 2, tolerance)
  );
}