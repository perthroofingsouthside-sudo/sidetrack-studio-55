import { create } from 'zustand';
import { PlaybackState } from '@/types';

interface AudioState {
  // Playback
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;

  // Microphone
  micEnabled: boolean;
  micVolume: number;
  micLevel: number;

  // Effects
  enabledEffects: string[];

  // State management
  setPlaybackState: (state: Partial<PlaybackState>) => void;
  setMicrophoneState: (enabled: boolean, volume: number) => void;
  setMicLevel: (level: number) => void;
  setVolume: (volume: number) => void;
  toggleEffect: (effectId: string) => void;
  addEffect: (effectId: string) => void;
  removeEffect: (effectId: string) => void;
  reset: () => void;
}

const initialState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  micEnabled: false,
  micVolume: 0.8,
  micLevel: 0,
  enabledEffects: [],
};

export const useAudioStore = create<AudioState>((set) => ({
  ...initialState,

  setPlaybackState: (state) =>
    set({
      isPlaying: state.isPlaying ?? initialState.isPlaying,
      currentTime: state.currentTime ?? initialState.currentTime,
      duration: state.duration ?? initialState.duration,
      volume: state.volume ?? initialState.volume,
    }),

  setMicrophoneState: (enabled, volume) =>
    set({
      micEnabled: enabled,
      micVolume: volume,
    }),

  setMicLevel: (level) => set({ micLevel: level }),

  setVolume: (volume) => set({ volume }),

  toggleEffect: (effectId) =>
    set((state) => {
      const effects = new Set(state.enabledEffects);
      if (effects.has(effectId)) {
        effects.delete(effectId);
      } else {
        effects.add(effectId);
      }
      return { enabledEffects: Array.from(effects) };
    }),

  addEffect: (effectId) =>
    set((state) => {
      const effects = new Set(state.enabledEffects);
      effects.add(effectId);
      return { enabledEffects: Array.from(effects) };
    }),

  removeEffect: (effectId) =>
    set((state) => {
      const effects = new Set(state.enabledEffects);
      effects.delete(effectId);
      return { enabledEffects: Array.from(effects) };
    }),

  reset: () => set(initialState),
}));

export default useAudioStore;