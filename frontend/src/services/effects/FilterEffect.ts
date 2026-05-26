import { Effect } from './Effect';

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'allpass';

/**
 * Filter Effect
 * EQ filtering using biquad filter
 */
export class FilterEffect extends Effect {
  private filterNode: BiquadFilterNode;

  constructor(context: AudioContext, filterType: FilterType = 'lowpass', id: string = 'filter') {
    super(id, `${filterType.charAt(0).toUpperCase() + filterType.slice(1)} Filter`);
    this.filterNode = context.createBiquadFilter();
    this.filterNode.type = filterType as BiquadFilterType;
    this.params.set('frequency', 1000);
    this.params.set('q', 1);
    this.params.set('gain', 0);
  }

  getNode(): AudioNode {
    return this.filterNode;
  }

  protected updateParameter(name: string, value: number): void {
    switch (name) {
      case 'frequency':
        this.filterNode.frequency.value = Math.max(20, Math.min(20000, value));
        break;
      case 'q':
        this.filterNode.Q.value = Math.max(0.1, Math.min(30, value));
        break;
      case 'gain':
        this.filterNode.gain.value = Math.max(-40, Math.min(40, value));
        break;
    }
  }

  /**
   * Set filter frequency
   */
  setFrequency(frequency: number): void {
    this.setParameter('frequency', frequency);
  }

  /**
   * Set filter Q (resonance)
   */
  setQ(q: number): void {
    this.setParameter('q', q);
  }

  /**
   * Set filter gain (for peaking filters)
   */
  setGain(gain: number): void {
    this.setParameter('gain', gain);
  }

  /**
   * Get filter type
   */
  getFilterType(): FilterType {
    return this.filterNode.type as FilterType;
  }
}

export default FilterEffect;