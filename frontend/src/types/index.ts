// Audio Types
export interface AudioConfig {
  sampleRate: number;
  bufferSize: number;
  outputChannels: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

// Sample Types
export interface Sample {
  id: string;
  name: string;
  duration: number;
  pitch: number;
  volume: number;
  fileData?: ArrayBuffer;
  category?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SampleBank {
  id: string;
  name: string;
  samples: Sample[];
  createdAt: number;
}

// Song/Track Types
export interface SongNote {
  startTime: number; // in milliseconds
  endTime: number;
  pitch: number; // MIDI note number (0-127)
  difficulty: 'easy' | 'normal' | 'hard';
}

export interface LyricsLine {
  startTime: number;
  endTime: number;
  text: string;
  phonetic?: string; // For non-English languages
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  difficulty: 'easy' | 'normal' | 'hard';
  genre: string;
  year?: number;
  language: string;
  backingTrackUrl: string; // Path to karaoke backing track
  notes: SongNote[];
  lyrics: LyricsLine[];
  coverImageUrl?: string;
  originalKey?: number; // MIDI key
  bpm?: number;
  tags?: string[];
  views?: number;
  rating?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SongLibraryIndex {
  total: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  songs: Song[];
  filters: SongFilters;
}

export interface SongFilters {
  searchQuery?: string;
  genre?: string;
  difficulty?: 'easy' | 'normal' | 'hard';
  language?: string;
  artist?: string;
  yearMin?: number;
  yearMax?: number;
  tags?: string[];
  minRating?: number;
  sortBy?: 'title' | 'artist' | 'difficulty' | 'views' | 'rating' | 'recent';
  sortOrder?: 'asc' | 'desc';
}

// Game Types
export interface NoteEvent {
  noteData: SongNote;
  status: 'pending' | 'hit' | 'missed';
  detectedPitch?: number;
  accuracy?: number; // 0-100
  score?: number;
}

export interface GameState {
  songId: string;
  score: number;
  combo: number;
  maxCombo: number;
  accuracy: number;
  notesHit: number;
  notesMissed: number;
  currentTime: number;
  isPlaying: boolean;
  isPaused: boolean;
  gameOver: boolean;
}

export interface GameResult {
  songId: string;
  songTitle: string;
  artist: string;
  finalScore: number;
  accuracy: number;
  combo: number;
  notesHit: number;
  notesMissed: number;
  duration: number;
  difficulty: 'easy' | 'normal' | 'hard';
  playerName?: string;
  timestamp: number;
  rating?: number;
}

// Pitch Detection Types
export interface PitchData {
  pitch: number; // Hz
  confidence: number; // 0-1
  timestamp: number;
}

export interface PitchHistory {
  data: PitchData[];
  windowSize: number;
  smoothed: boolean;
}

// Microphone Types
export interface MicrophoneConfig {
  enabled: boolean;
  volume: number;
  noiseGate?: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

// Effects Types
export interface EffectConfig {
  type: 'gain' | 'filter' | 'delay' | 'reverb' | 'distortion';
  enabled: boolean;
  parameters: Record<string, number>;
}

export interface EffectChain {
  id: string;
  name: string;
  effects: EffectConfig[];
  enabled: boolean;
}

// Sequence/Pattern Types
export interface SequenceStep {
  sampleId: string;
  pitch: number;
  volume: number;
  effects: EffectConfig[];
  muted: boolean;
}

export interface SequencePattern {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number]; // [numerator, denominator]
  steps: SequenceStep[][];
  duration: number;
  createdAt: number;
  updatedAt: number;
}

// Player/Session Types
export interface Player {
  id: string;
  name: string;
  stats: PlayerStats;
  preferences: PlayerPreferences;
}

export interface PlayerStats {
  totalSongsPlayed: number;
  totalScore: number;
  averageAccuracy: number;
  bestScore: number;
  favoriteGenre: string;
  playHistory: GameResult[];
}

export interface PlayerPreferences {
  volume: number;
  difficulty: 'easy' | 'normal' | 'hard';
  language: string;
  captions: boolean;
  neonTheme: boolean;
}

// Gamepad Types
export interface GamepadState {
  connected: boolean;
  buttons: boolean[];
  axes: number[];
  id: string;
  index: number;
  mapping: 'standard' | 'xr-standard' | 'unknown';
}

export interface GamepadInput {
  button?: number;
  axis?: number;
  value: number;
  timestamp: number;
  playerId: string;
}

export interface GamepadConfig {
  deadzone: number;
  triggerThreshold: number;
  buttonMapping: Record<string, string>;
  axisMapping: Record<string, string>;
}