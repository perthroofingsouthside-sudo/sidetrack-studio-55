import audioContext from '../audioContext';
import audioLoader from '../audioLoader';
import { formatTime } from '../audioUtils';

export interface PlayerEventMap {
  play: { currentTime: number };
  pause: { currentTime: number };
  stop: { currentTime: number };
  ended: { duration: number };
  timeupdate: { currentTime: number };
  volumechange: { volume: number };
  error: { message: string };
}

type PlayerEventListener<K extends keyof PlayerEventMap> = (data: PlayerEventMap[K]) => void;

/**
 * Audio Playback Engine
 * Handles audio buffer playback with controls
 */
export class Player {
  private audioBuffer: AudioBuffer | null = null;
  private source: AudioBufferSource​Node | null = null;
  private gainNode: GainNode;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private updateInterval: number | null = null;

  constructor() {
    this.gainNode = audioContext.createGainNode();
    this.gainNode.connect(audioContext.getMasterGain());
  }

  /**
   * Load audio file
   */
  async load(source: string | File): Promise<void> {
    try {
      this.audioBuffer = await audioLoader.loadAudio(source);
      console.log(`✓ Audio loaded: ${this.audioBuffer?.duration.toFixed(2)}s`);
    } catch (error) {
      this.emit('error', { message: `Failed to load audio: ${error}` });
      throw error;
    }
  }

  /**
   * Play audio
   */
  play(): void {
    if (!audioContext.isRunning()) {
      console.warn('Audio context not running');
      return;
    }

    if (!this.audioBuffer) {
      console.warn('No audio buffer loaded');
      return;
    }

    if (this.isPlaying) return;

    // Create new source node
    this.source = audioContext.getContext().createBufferSource();
    this.source.buffer = this.audioBuffer;
    this.source.connect(this.gainNode);

    // Handle ended event
    this.source.onended = () => {
      this.isPlaying = false;
      this.emit('ended', { duration: this.audioBuffer?.duration || 0 });
    };

    // Start playback
    this.startTime = audioContext.getCurrentTime() - this.pauseTime;
    this.source.start(0, this.pauseTime);
    this.isPlaying = true;

    this.emit('play', { currentTime: this.pauseTime });
    this.startUpdateLoop();
  }

  /**
   * Pause audio
   */
  pause(): void {
    if (!this.isPlaying) return;

    if (this.source) {
      this.pauseTime = audioContext.getCurrentTime() - this.startTime;
      this.source.stop();
      this.source = null;
    }

    this.isPlaying = false;
    this.stopUpdateLoop();
    this.emit('pause', { currentTime: this.pauseTime });
  }

  /**
   * Stop audio and reset
   */
  stop(): void {
    this.pause();
    this.pauseTime = 0;
    this.emit('stop', { currentTime: 0 });
  }

  /**
   * Set playback volume (0-1)
   */
  setVolume(volume: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    this.emit('volumechange', { volume });
  }

  /**
   * Get playback volume
   */
  getVolume(): number {
    return this.gainNode.gain.value;
  }

  /**
   * Set playback position in seconds
   */
  setCurrentTime(time: number): void {
    if (!this.audioBuffer) return;

    const clampedTime = Math.max(0, Math.min(time, this.audioBuffer.duration));
    this.pauseTime = clampedTime;

    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  /**
   * Get current playback position
   */
  getCurrentTime(): number {
    if (!this.isPlaying) return this.pauseTime;
    return audioContext.getCurrentTime() - this.startTime;
  }

  /**
   * Get audio duration
   */
  getDuration(): number {
    return this.audioBuffer?.duration || 0;
  }

  /**
   * Check if audio is playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get formatted current time
   */
  getFormattedCurrentTime(): string {
    return formatTime(this.getCurrentTime());
  }

  /**
   * Get formatted duration
   */
  getFormattedDuration(): string {
    return formatTime(this.getDuration());
  }

  /**
   * Start update loop for timeupdate events
   */
  private startUpdateLoop(): void {
    if (this.updateInterval) return;

    this.updateInterval = window.setInterval(() => {
      if (this.isPlaying) {
        this.emit('timeupdate', { currentTime: this.getCurrentTime() });
      }
    }, 50);
  }

  /**
   * Stop update loop
   */
  private stopUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof PlayerEventMap>(event: K, listener: PlayerEventListener<K>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof PlayerEventMap>(event: K, listener: PlayerEventListener<K>): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  /**
   * Emit event
   */
  private emit<K extends keyof PlayerEventMap>(event: K, data: PlayerEventMap[K]): void {
    this.eventListeners.get(event)?.forEach((listener) => {
      listener(data);
    });
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stop();
    this.stopUpdateLoop();
    this.gainNode.disconnect();
    this.audioBuffer = null;
    this.eventListeners.clear();
  }
}

export default Player;