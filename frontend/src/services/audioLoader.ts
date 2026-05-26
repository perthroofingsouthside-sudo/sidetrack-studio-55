import audioContext from './audioContext';

/**
 * Audio File Loader Service
 * Handles loading and decoding audio files in various formats
 */
class AudioLoader {
  private static instance: AudioLoader;
  private decodedCache: Map<string, AudioBuffer> = new Map();
  private isCaching: boolean = true;

  private constructor() {}

  static getInstance(): AudioLoader {
    if (!AudioLoader.instance) {
      AudioLoader.instance = new AudioLoader();
    }
    return AudioLoader.instance;
  }

  /**
   * Load audio file from URL or File object
   * Returns decoded AudioBuffer
   */
  async loadAudio(source: string | File, cacheKey?: string): Promise<AudioBuffer> {
    // Check cache first
    const key = cacheKey || (typeof source === 'string' ? source : source.name);
    if (this.decodedCache.has(key)) {
      console.log(`✓ Audio loaded from cache: ${key}`);
      return this.decodedCache.get(key)!;
    }

    try {
      let arrayBuffer: ArrayBuffer;

      if (typeof source === 'string') {
        // Load from URL
        arrayBuffer = await this.fetchAudioBuffer(source);
      } else {
        // Load from File object
        arrayBuffer = await this.readFileAsArrayBuffer(source);
      }

      // Decode audio data
      const audioBuffer = await this.decodeAudioBuffer(arrayBuffer);

      // Cache the decoded audio
      if (this.isCaching) {
        this.decodedCache.set(key, audioBuffer);
      }

      console.log(`✓ Audio loaded and decoded: ${key}`);
      return audioBuffer;
    } catch (error) {
      console.error(`✗ Failed to load audio: ${source}`, error);
      throw new Error(`Audio loading failed: ${error}`);
    }
  }

  /**
   * Load multiple audio files
   */
  async loadAudioBatch(
    sources: (string | File)[],
    progressCallback?: (progress: number) => void,
  ): Promise<AudioBuffer[]> {
    const results: AudioBuffer[] = [];
    const total = sources.length;

    for (let i = 0; i < total; i++) {
      try {
        const buffer = await this.loadAudio(sources[i]);
        results.push(buffer);
        progressCallback?.(((i + 1) / total) * 100);
      } catch (error) {
        console.warn(`Failed to load audio ${i}:`, error);
        results.push(null as any); // Placeholder for failed loads
      }
    }

    return results;
  }

  /**
   * Fetch audio buffer from URL
   */
  private async fetchAudioBuffer(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  /**
   * Read File object as ArrayBuffer
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Decode ArrayBuffer to AudioBuffer
   */
  private async decodeAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = audioContext.getContext();
    return new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, resolve, (error) => {
        reject(new Error(`Audio decode failed: ${error.message}`));
      });
    });
  }

  /**
   * Get audio buffer from cache
   */
  getFromCache(key: string): AudioBuffer | undefined {
    return this.decodedCache.get(key);
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(key: string): void {
    this.decodedCache.delete(key);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.decodedCache.clear();
    console.log('✓ Audio cache cleared');
  }

  /**
   * Get cache size in MB
   */
  getCacheSize(): number {
    let totalSize = 0;
    this.decodedCache.forEach((buffer) => {
      totalSize += buffer.length * buffer.numberOfChannels * 4; // 32-bit float
    });
    return totalSize / (1024 * 1024); // Convert to MB
  }

  /**
   * Set caching behavior
   */
  setCaching(enabled: boolean): void {
    this.isCaching = enabled;
  }

  /**
   * Get supported audio formats
   */
  getSupportedFormats(): string[] {
    const audio = document.createElement('audio');
    const formats: string[] = [];

    if (audio.canPlayType('audio/mpeg')) formats.push('mp3');
    if (audio.canPlayType('audio/wav')) formats.push('wav');
    if (audio.canPlayType('audio/ogg')) formats.push('ogg');
    if (audio.canPlayType('audio/aac')) formats.push('aac');
    if (audio.canPlayType('audio/webm')) formats.push('webm');

    return formats;
  }
}

export default AudioLoader.getInstance();