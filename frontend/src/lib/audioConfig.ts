// Audio Configuration Constants
export const AUDIO_CONFIG = {
  sampleRate: 44100,
  bufferSize: 4096,
  outputChannels: 2,
  maxPolyphony: 32,
} as const;

// Microphone Configuration Defaults
export const MICROPHONE_CONFIG_DEFAULTS = {
  enabled: true,
  volume: 0.8,
  noiseGate: -40, // dB
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

// Pitch Detection Configuration
export const PITCH_DETECTION_CONFIG = {
  minFrequency: 50, // Hz (below human voice range)
  maxFrequency: 2000, // Hz (typical singing range)
  confidenceThreshold: 0.9, // 0-1
  smoothingWindow: 5, // number of frames to smooth over
  frameSize: 4096,
  hopLength: 512,
  fftSize: 4096,
} as const;

// Game Configuration
export const GAME_CONFIG = {
  hitWindowMs: 150, // +/- 150ms from target note
  scoringMultiplier: {
    perfect: 100,
    great: 80,
    good: 60,
    miss: 0,
  },
  comboMultiplier: {
    base: 1,
    increment: 0.1,
    max: 2.0,
  },
  notesFallDuration: 2000, // ms
  noteHeight: 40, // px
  playbackLeadTime: 500, // ms before note reaches hit zone
} as const;

// Sequencer Configuration
export const SEQUENCER_CONFIG = {
  defaultBPM: 120,
  minBPM: 40,
  maxBPM: 240,
  defaultTimeSignature: [4, 4] as [number, number],
  gridSize: 16, // steps per measure
  maxTracks: 16,
} as const;

// Storage Configuration for 4000+ Songs
export const STORAGE_CONFIG = {
  dbName: 'SidetrackStudio',
  dbVersion: 1,
  songStoreKey: 'songs',
  sampleStoreKey: 'samples',
  patternStoreKey: 'patterns',
  sessionStoreKey: 'sessions',
  maxStorageSize: 2 * 1024 * 1024 * 1024, // 2GB for large library
  songPageSize: 100, // Load 100 songs at a time
  indexingStrategy: 'full-text-search', // For searching 4000 songs
} as const;

// UI Configuration
export const UI_CONFIG = {
  animationDuration: 300, // ms
  transitionDuration: 200, // ms
  debounceDelay: 150, // ms
  throttleDelay: 50, // ms
} as const;

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  targetFPS: 60,
  enableAudioWorklet: true,
  audioWorkletBufferSize: 4096,
  maxConcurrentAudioNodes: 64,
  memoryWarningThreshold: 0.8, // 80% of available
} as const;

// MIDI Configuration
export const MIDI_CONFIG = {
  minNote: 0,
  maxNote: 127,
  defaultVelocity: 100,
  noteOnThreshold: 10,
  noteOffThreshold: 0,
} as const;

// Error Codes
export const ERROR_CODES = {
  AUDIO_CONTEXT_FAILED: 'AUDIO_001',
  MICROPHONE_DENIED: 'AUDIO_002',
  SAMPLE_LOAD_FAILED: 'AUDIO_003',
  PLAYBACK_FAILED: 'AUDIO_004',
  PITCH_DETECTION_FAILED: 'AUDIO_005',
  GAMEPAD_NOT_AVAILABLE: 'INPUT_001',
  INVALID_SONG_FORMAT: 'GAME_001',
  SCORE_CALCULATION_FAILED: 'GAME_002',
} as const;