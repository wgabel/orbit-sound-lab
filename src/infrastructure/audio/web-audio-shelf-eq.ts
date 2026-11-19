import type { DroneShelfSettings, ShelfEqSettings } from '../../domain/drone';
import { getShelfFrequencyHz } from '../../domain/drone-shelf-response';

export class WebAudioShelfEq {
  readonly lowShelf: BiquadFilterNode;
  readonly highShelf: BiquadFilterNode;

  constructor(private readonly context: BaseAudioContext, settings: ShelfEqSettings) {
    this.lowShelf = this.createShelf('lowshelf',settings.lowShelf);
    this.highShelf = this.createShelf('highshelf',settings.highShelf);
    this.lowShelf.connect(this.highShelf);
  }

  private createShelf(type: 'lowshelf' | 'highshelf', settings: DroneShelfSettings): BiquadFilterNode {
    const node = this.context.createBiquadFilter();
    node.type = type;
    node.frequency.value = getShelfFrequencyHz(settings.frequencyHz,this.context.sampleRate);
    node.gain.value = settings.gainDecibels;
    return node;
  }

  update(settings: ShelfEqSettings, now: number): void {
    this.updateShelf(this.lowShelf,settings.lowShelf,now);
    this.updateShelf(this.highShelf,settings.highShelf,now);
  }

  private updateShelf(node: BiquadFilterNode, settings: DroneShelfSettings, now: number): void {
    node.frequency.setTargetAtTime(getShelfFrequencyHz(settings.frequencyHz,this.context.sampleRate),now,0.02);
    node.gain.setTargetAtTime(settings.gainDecibels,now,0.02);
  }

  dispose(): void {
    this.lowShelf.disconnect();
    this.highShelf.disconnect();
  }
}
