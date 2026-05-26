import { AUDIO_CONFIG } from '@/lib/audioConfig';

/**
 * Singleton Web Audio API Context Manager
 * Handles initialization, lifecycle, and global audio state
 */
class AudioContextManager {
  private static instance: AudioContextManager;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isInitialized: boolean = false;
  private resumeListener: (() => void) | null = null;

  private constructor() {}

  /**
   * Get or create the singleton instance
   */
  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  /**
   * Initialize the Web Audio API context
   * Must be called after user interaction (browser requirement)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create audio context with correct sample rate
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.sampleRate,
      });

      // Create master gain node
      const masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      masterGain.gain.value = 1;

      // Create analyser for monitoring
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      masterGain.connect(analyser);

      this.audioContext = audioContext;
      this.masterGain = masterGain;
      this.analyser = analyser;
      this.isInitialized = true;

      // Handle resume on user interaction
      this.setupResumeListener();

      console.log('✓ Audio Context initialized');
    } catch (error) {
      console.error('✗ Failed to initialize Audio Context:', error);
      throw new Error('Audio Context initialization failed');
    }
  }

  /**
   * Resume audio context if suspended (browser requirement)
   */
  private setupResumeListener(): void {
    if (!this.audioContext) return;

    this.resumeListener = async () => {
      try {
        if (this.audioContext?.state === 'suspended') {
          await this.audioContext.resume();
          console.log('✓ Audio Context resumed');
        }
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    };

    document.addEventListener('click', this.resumeListener);
    document.addEventListener('touchstart', this.resumeListener);
  }

  /**
   * Get the Web Audio Context
   */
  getContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error('Audio Context not initialized. Call initialize() first.');
    }
    return this.audioContext;
  }

  /**
   * Get the master gain node
   */
  getMasterGain(): GainNode {
    if (!this.masterGain) {
      throw new Error('Master gain not initialized');
    }
    return this.masterGain;
  }

  /**
   * Get the analyser node
   */
  getAnalyser(): AnalyserNode {
    if (!this.analyser) {
      throw new Error('Analyser not initialized');
    }
    return this.analyser;
  }

  /**
   * Set master volume (0-1)
   */
  setMasterVolume(volume: number): void {
    if (!this.masterGain) return;
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  /**
   * Get master volume
   */
  getMasterVolume(): number {
    if (!this.masterGain) return 0;
    return this.masterGain.gain.value;
  }

  /**
   * Check if audio context is running
   */
  isRunning(): boolean {
    return this.isInitialized && this.audioContext?.state === 'running';
  }

  /**
   * Get current audio context state
   */
  getState(): AudioContextState {
    if (!this.audioContext) return 'suspended';
    return this.audioContext.state;
  }

  /**
   * Get current playback time in seconds
   */
  getCurrentTime(): number {
    if (!this.audioContext) return 0;
    return this.audioContext.currentTime;
  }

  /**
   * Get sample rate
   */
  getSampleRate(): number {
    if (!this.audioContext) return AUDIO_CONFIG.sampleRate;
    return this.audioContext.sampleRate;
  }

  /**
   * Create a gain node connected to master
   */
  createGainNode(): GainNode {
    if (!this.audioContext) {
      throw new Error('Audio Context not initialized');
    }
    return this.audioContext.createGain();
  }

  /**
   * Create a filter node
   */
  createFilterNode(): BiquadFilterNode {
    if (!this.audioContext) {
      throw new Error('Audio Context not initialized');
    }
    return this.audioContext.createBiquadFilter();
  }

  /**
   * Create a delay node
   */
  createDelayNode(maxTime: number = 5): DelayNode {
    if (!this.audioContext) {
      throw new Error('Audio Context not initialized');
    }
    return this.audioContext.createDelay(maxTime);
  }

  /**
   * Create a convolver (reverb) node
   */
  createConvolverNode(): ConvolverNode {
    if (!this.audioContext) {
      throw new Error('Audio Context not initialized');
    }
    return this.audioContext.createConvolver();
  }

  /**
   * Create a panner (spatial) node
   */
  createPannerNode(): PannerNode {
    if (!this.audioContext) {
      throw new Error('Audio Context not initialized');
    }
    return this.audioContext.createPanner();
  }

  /**
   * Create a stereo panner node
   */
  createStereoPannerNode(): StereoPannerNode {
    if (!this.audioContext) {
      throw new Error('Audio Context not initialized');
    }
    return this.audioContext.createStereoPanner();
  }

  /**
   * Cleanup and disconnect
   */
  disconnect(): void {
    if (this.resumeListener) {
      document.removeEventListener('click', this.resumeListener);
      document.removeEventListener('touchstart', this.resumeListener);
    }

    if (this.audioContext) {
      this.audioContext.close().catch((err) => {
        console.error('Error closing audio context:', err);
      });
      this.audioContext = null;
    }

    this.masterGain = null;
    this.analyser = null;
    this.isInitialized = false;
  }
}

export default AudioContextManager.getInstance();