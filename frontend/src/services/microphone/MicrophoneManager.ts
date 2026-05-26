import audioContext from '../audioContext';
import { MICROPHONE_CONFIG_DEFAULTS } from '@/lib/audioConfig';
import { MicrophoneConfig } from '@/types';

export interface MicrophoneEventMap {
  ready: { stream: MediaStream };
  error: { code: string; message: string };
  levelchange: { level: number };
  close: {};
}

type MicrophoneEventListener<K extends keyof MicrophoneEventMap> = (
  data: MicrophoneEventMap[K],
) => void;

/**
 * Microphone Manager
 * Handles microphone input, permissions, and audio stream setup
 */
export class MicrophoneManager {
  private static instance: MicrophoneManager;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private config: MicrophoneConfig = { ...MICROPHONE_CONFIG_DEFAULTS };
  private eventListeners: Map<string, Set<Function>> = new Map();
  private levelMonitorInterval: number | null = null;

  private constructor() {}

  static getInstance(): MicrophoneManager {
    if (!MicrophoneManager.instance) {
      MicrophoneManager.instance = new MicrophoneManager();
    }
    return MicrophoneManager.instance;
  }

  /**
   * Request microphone access and initialize audio stream
   */
  async initialize(): Promise<void> {
    if (this.stream) {
      console.log('✓ Microphone already initialized');
      return;
    }

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
        },
      });

      // Create audio source from stream
      const ctx = audioContext.getContext();
      this.source = ctx.createMediaStreamSource(this.stream);

      // Create gain node for input volume control
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = this.config.volume;
      this.source.connect(this.gainNode);

      // Create analyser for pitch detection
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 4096;
      this.gainNode.connect(this.analyser);

      // Also connect to master for monitoring
      this.gainNode.connect(audioContext.getMasterGain());

      console.log('✓ Microphone initialized successfully');
      this.emit('ready', { stream: this.stream });
      this.startLevelMonitoring();
    } catch (error) {
      const errorCode = (error as any).name || 'UNKNOWN';
      const errorMessage = this.getErrorMessage(errorCode);
      console.error(`✗ Microphone initialization failed: ${errorMessage}`, error);
      this.emit('error', { code: errorCode, message: errorMessage });
      throw error;
    }
  }

  /**
   * Close microphone stream
   */
  close(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.stopLevelMonitoring();
    this.emit('close', {});
    console.log('✓ Microphone closed');
  }

  /**
   * Set microphone input volume (0-1)
   */
  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.config.volume;
    }
  }

  /**
   * Get microphone input volume
   */
  getVolume(): number {
    return this.config.volume;
  }

  /**
   * Get analyser node for pitch detection
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Get media stream
   */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Check if microphone is active
   */
  isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<MicrophoneConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): MicrophoneConfig {
    return { ...this.config };
  }

  /**
   * Start monitoring microphone level
   */
  private startLevelMonitoring(): void {
    if (this.levelMonitorInterval) return;

    this.levelMonitorInterval = window.setInterval(() => {
      if (this.analyser) {
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);

        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        const level = Math.round(sum / data.length);

        this.emit('levelchange', { level });
      }
    }, 100);
  }

  /**
   * Stop level monitoring
   */
  private stopLevelMonitoring(): void {
    if (this.levelMonitorInterval) {
      clearInterval(this.levelMonitorInterval);
      this.levelMonitorInterval = null;
    }
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      NotAllowedError: 'Microphone access denied. Please allow microphone access.',
      NotFoundError: 'No microphone found on this device.',
      NotReadableError: 'Microphone is already in use by another application.',
      SecurityError: 'Microphone access blocked by security policy.',
      TypeError: 'Invalid microphone configuration.',
    };
    return messages[errorCode] || `Microphone error: ${errorCode}`;
  }

  /**
   * Add event listener
   */
  on<K extends keyof MicrophoneEventMap>(
    event: K,
    listener: MicrophoneEventListener<K>,
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof MicrophoneEventMap>(
    event: K,
    listener: MicrophoneEventListener<K>,
  ): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  /**
   * Emit event
   */
  private emit<K extends keyof MicrophoneEventMap>(
    event: K,
    data: MicrophoneEventMap[K],
  ): void {
    this.eventListeners.get(event)?.forEach((listener) => {
      listener(data);
    });
  }
}

export default MicrophoneManager.getInstance();