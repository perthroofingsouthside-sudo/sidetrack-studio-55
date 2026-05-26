import { Effect } from './Effect';

/**
 * Gain Effect
 * Controls volume/amplitude
 */
export class GainEffect extends Effect {
  private gainNode: GainNode;

  constructor(context: AudioContext, id: string = 'gain') {
    super(id, 'Gain');
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 1;
    this.params.set('gain', 1);
  }

  getNode(): AudioNode {
    return this.gainNode;
  }

  protected updateParameter(name: string, value: number): void {
    if (name === 'gain') {
      this.gainNode.gain.value = Math.max(0, Math.min(2, value));
    }
  }

  /**
   * Convenience method to set gain
   */
  setGain(value: number): void {
    this.setParameter('gain', value);
  }

  /**
   * Get current gain value
   */
  getGain(): number {
    return this.gainNode.gain.value;
  }
}

export default GainEffect;