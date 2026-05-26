import { Effect } from './Effect';
import audioContext from '../audioContext';

/**
 * Effect Chain Manager
 * Manages a series of effects in sequence
 */
export class EffectChain {
  private effects: Effect[] = [];
  private input: GainNode;
  private output: GainNode;
  private enabled: boolean = true;

  constructor(
    public id: string,
    public name: string,
  ) {
    this.input = audioContext.createGainNode();
    this.output = audioContext.createGainNode();
  }

  /**
   * Add effect to chain
   */
  addEffect(effect: Effect): void {
    this.effects.push(effect);
    this.rebuildChain();
  }

  /**
   * Remove effect from chain
   */
  removeEffect(effectId: string): void {
    this.effects = this.effects.filter((e) => e.id !== effectId);
    this.rebuildChain();
  }

  /**
   * Insert effect at position
   */
  insertEffect(effect: Effect, position: number): void {
    this.effects.splice(position, 0, effect);
    this.rebuildChain();
  }

  /**
   * Get effect by ID
   */
  getEffect(effectId: string): Effect | undefined {
    return this.effects.find((e) => e.id === effectId);
  }

  /**
   * Get all effects
   */
  getEffects(): Effect[] {
    return [...this.effects];
  }

  /**
   * Reorder effects in chain
   */
  reorderEffect(effectId: string, newPosition: number): void {
    const effect = this.effects.find((e) => e.id === effectId);
    if (!effect) return;

    this.effects = this.effects.filter((e) => e.id !== effectId);
    this.effects.splice(newPosition, 0, effect);
    this.rebuildChain();
  }

  /**
   * Rebuild signal chain
   */
  private rebuildChain(): void {
    // Disconnect everything
    this.input.disconnect();
    this.effects.forEach((effect) => effect.disconnect());

    if (this.effects.length === 0) {
      // If no effects, connect input directly to output
      this.input.connect(this.output);
    } else {
      // Connect input to first effect
      this.input.connect(this.effects[0].getNode());

      // Connect effects in series
      for (let i = 0; i < this.effects.length - 1; i++) {
        this.effects[i].connect(this.effects[i + 1].getNode());
      }

      // Connect last effect to output
      this.effects[this.effects.length - 1].connect(this.output);
    }
  }

  /**
   * Connect chain to destination
   */
  connect(destination: AudioNode): void {
    this.output.connect(destination);
  }

  /**
   * Disconnect chain
   */
  disconnect(): void {
    this.output.disconnect();
  }

  /**
   * Get input node
   */
  getInput(): GainNode {
    return this.input;
  }

  /**
   * Enable chain
   */
  enable(): void {
    this.enabled = true;
    this.effects.forEach((effect) => effect.enable());
  }

  /**
   * Disable chain (bypass)
   */
  disable(): void {
    this.enabled = false;
    this.effects.forEach((effect) => effect.disable());
  }

  /**
   * Check if chain is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clear all effects
   */
  clear(): void {
    this.effects.forEach((effect) => effect.dispose());
    this.effects = [];
    this.rebuildChain();
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.disconnect();
    this.clear();
    this.input.disconnect();
    this.output.disconnect();
  }
}

export default EffectChain;