import moduleUrl from './pitch-shift.worklet.js?url&no-inline';

export class WebAudioPitchShiftWorkletFactory {
  private readonly registration: Promise<boolean>;
  private ready = false;

  constructor(private readonly context: AudioContext) {
    this.registration = context.audioWorklet?.addModule(moduleUrl).then(() => true).catch(() => false)
      ?? Promise.resolve(false);
  }

  async prepare(): Promise<void> {
    this.ready = await this.registration;
  }

  create(semitones: number, cents: number) {
    if (!this.ready) throw new Error('Pitch Shift automation needs AudioWorklet in this browser.');
    const node = new AudioWorkletNode(this.context,'orbit-pitch-shift',{
      numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],
      channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers',
      parameterData:{semitones},processorOptions:{semitones,cents}
    });
    const pitch = node.parameters.get('semitones');
    if (!pitch) {
      node.port.postMessage('stop');
      node.port.close();
      node.disconnect();
      throw new Error('Pitch Shift automation input is unavailable.');
    }
    return {
      input:node,
      output:node,
      pitch,
      dispose() {
        node.port.postMessage('stop');
        node.port.close();
        node.disconnect();
      }
    };
  }
}
