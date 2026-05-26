/**
 * Base Effect Class
 * Abstract class for all audio effects
 */
export abstract class Effect {
  protected enabled: boolean = true;
  protected params: Map<string, number> = new Map();

  constructor(
    public id: string,
    public name: string,
  ) {}

  /**
   * Abstract method to get the audio node
   */
  abstract getNode(): AudioNode;

  /**
   * Connect to next node in chain
   */
  connect(destination: AudioNode): void {
    this.getNode().connect(destination);
  }

  /**
   * Disconnect from next node
   */
  disconnect(): void {
    this.getNode().disconnect();
  }

  /**
   * Enable effect
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable effect (bypass)
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Toggle effect
   */
  toggle(): void {
    this.enabled = !this.enabled;
  }

  /**
   * Check if effect is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set parameter value
   */
  setParameter(name: string, value: number): void {
    this.params.set(name, value);
    this.updateParameter(name, value);
  }

  /**
   * Get parameter value
   */
  getParameter(name: string): number | undefined {
    return this.params.get(name);
  }

  /**
   * Abstract method to update parameter
   */
  protected abstract updateParameter(name: string, value: number): void;

  /**
   * Get all parameters
   */
  getParameters(): Record<string, number> {
    const obj: Record<string, number> = {};
    this.params.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.disconnect();
    this.params.clear();
  }
}

export default Effect;