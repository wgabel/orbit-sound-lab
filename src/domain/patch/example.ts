import { createDefaultDroneSettings } from '@domain/drone';
import { createPatchModule } from './module-definitions';
import type { Patch } from './model';

export function createExamplePatch(): Patch {
  const drone = createDefaultDroneSettings();
  return {
    version:1,
    modules:[
      {id:'drone',kind:'drone',settings:{voice:{...drone,gain:0.24,
        oscillators:drone.oscillators.map((oscillator,index) => ({...oscillator,
          enabled:index < 3,waveform:index === 1 ? 'sawtooth' : 'triangle',
          frequencyHz:[110,164.81,220.4,330,440][index],volume:0.65,
          pan:[-0.3,0.2,0.4,0,0][index]}))}}},
      createPatchModule('filter','filter'),
      createPatchModule('gain','gain'),
      createPatchModule('output','output'),
      createPatchModule('automation','automation')
    ],
    cables:[
      {id:'drone-filter',source:{moduleId:'drone',portId:'out'},destination:{moduleId:'filter',portId:'in'}},
      {id:'filter-gain',source:{moduleId:'filter',portId:'out'},destination:{moduleId:'gain',portId:'in'}},
      {id:'gain-output',source:{moduleId:'gain',portId:'out'},destination:{moduleId:'output',portId:'in'}},
      {id:'filter-control',source:{moduleId:'automation',portId:'control'},
        destination:{moduleId:'filter',portId:'cutoff'},mapping:{from:180,to:2400}},
      {id:'gain-control',source:{moduleId:'automation',portId:'control'},
        destination:{moduleId:'gain',portId:'level'},mapping:{from:0.08,to:0.7}}
    ]
  };
}
