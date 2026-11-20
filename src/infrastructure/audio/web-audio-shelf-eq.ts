import type { DroneShelfSettings, ShelfEqSettings } from '@domain/drone';
import { getShelfFrequencyHz } from '@domain/drone-shelf-response';

export class WebAudioShelfEq {
  readonly lowShelf: BiquadFilterNode;
  readonly highShelf: BiquadFilterNode;

  constructor(private readonly context: BaseAudioContext, settings: ShelfEqSettings, enabled = true) {
    this.lowShelf = this.createShelf('lowshelf',settings.lowShelf,enabled);
    this.highShelf = this.createShelf('highshelf',settings.highShelf,enabled);
    this.lowShelf.connect(this.highShelf);
  }

  private createShelf(type: 'lowshelf' | 'highshelf', settings: DroneShelfSettings, enabled: boolean): BiquadFilterNode {
    const node = this.context.createBiquadFilter();
    node.type = type;
    node.frequency.value = getShelfFrequencyHz(settings.frequencyHz,this.context.sampleRate);
    node.gain.value = enabled ? settings.gainDecibels : 0;
    return node;
  }

  update(settings: ShelfEqSettings, now: number, enabled = true): void {
    this.updateShelf(this.lowShelf,settings.lowShelf,now,enabled);
    this.updateShelf(this.highShelf,settings.highShelf,now,enabled);
  }

  private updateShelf(node: BiquadFilterNode, settings: DroneShelfSettings, now: number, enabled: boolean): void {
    node.frequency.setTargetAtTime(getShelfFrequencyHz(settings.frequencyHz,this.context.sampleRate),now,0.02);
    node.gain.setTargetAtTime(enabled ? settings.gainDecibels : 0,now,0.02);
  }

  dispose(): void {
    this.lowShelf.disconnect();
    this.highShelf.disconnect();
  }
}
