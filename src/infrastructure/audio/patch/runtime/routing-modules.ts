import type { PatchRuntimeFactory } from './contracts';

export const createCrossfaderRuntime: PatchRuntimeFactory<'crossfader'> = (
  definition,{context}
) => {
  const channelA = context.createGain();
  const channelB = context.createGain();
  const output = context.createGain();
  const blend = context.createConstantSource();
  blend.offset.value = definition.settings.blend;
  const weightA = context.createWaveShaper();
  weightA.curve = new Float32Array([1,1,0]);
  const weightB = context.createWaveShaper();
  weightB.curve = new Float32Array([0,0,1]);
  channelA.gain.value = 0;
  channelB.gain.value = 0;
  blend.connect(weightA).connect(channelA.gain);
  blend.connect(weightB).connect(channelB.gain);
  channelA.connect(output);
  channelB.connect(output);
  blend.start();
  return {definition,inputs:{inputA:channelA,inputB:channelB},output,
    parameters:{blend:{parameter:blend.offset,base:definition.settings.blend}},dispose() {
      blend.stop();blend.disconnect();weightA.disconnect();weightB.disconnect();
      channelA.disconnect();channelB.disconnect();output.disconnect();
    }};
};

export const createMixerRuntime: PatchRuntimeFactory<'mixer'> = (definition,{context}) => {
  const channelA = context.createGain();
  const channelB = context.createGain();
  const output = context.createGain();
  const {levelA,levelB} = definition.settings;
  channelA.gain.value = levelA;
  channelB.gain.value = levelB;
  channelA.connect(output);
  channelB.connect(output);
  return {definition,inputs:{inputA:channelA,inputB:channelB},output,parameters:{
    levelA:{parameter:channelA.gain,base:levelA},
    levelB:{parameter:channelB.gain,base:levelB}
  },dispose() {channelA.disconnect();channelB.disconnect();output.disconnect();}};
};

export const createLevelRuntime: PatchRuntimeFactory<'gain' | 'output'> = (
  definition,{context,master}
) => {
  const gain = context.createGain();
  gain.gain.value = definition.settings.level;
  if (definition.kind === 'output') gain.connect(master);
  return {definition,inputs:{in:gain},output:gain,
    parameters:{level:{parameter:gain.gain,base:definition.settings.level}},
    dispose:() => gain.disconnect()};
};
