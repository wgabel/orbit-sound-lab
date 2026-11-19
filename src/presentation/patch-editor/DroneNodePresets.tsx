import { loadBuiltInOscillatorBank } from '../../domain/built-in-oscillator-banks';
import { createDefaultDelaySettings } from '../../domain/delay';
import { readPatchDroneLayer, setPatchDroneLayer } from '../../domain/patch';
import type { PatchDrone } from '../../domain/patch';
import { createDroneSnapshotName, createPreset, deletePreset, DRONE_PRESET_NAME_LIMIT,
  exportPreset, importPreset, listPresets, loadPresetSound, savePreset } from '../../domain/preset-library';
import { OscillatorBankPicker } from '../OscillatorBankPicker';
import { PresetLibrary } from './PresetLibrary';

export function DroneNodePresets({module, onLoad}: {module: PatchDrone; onLoad(module: PatchDrone): void}) {
  const layer = readPatchDroneLayer(module);

  return <>
    <div className="patch-drone-presets">
      <OscillatorBankPicker onLoad={id => onLoad(setPatchDroneLayer(module,loadBuiltInOscillatorBank(id,layer)))}/>
    </div>
    <PresetLibrary label="Drone" nameLimit={DRONE_PRESET_NAME_LIMIT} list={listPresets}
      save={name => savePreset(createPreset(name,layer.drone,layer.modulation,createDefaultDelaySettings(),layer.harmony))}
      createSnapshotName={createDroneSnapshotName} importFile={importPreset} exportFile={exportPreset}
      remove={deletePreset} onLoad={preset => onLoad(setPatchDroneLayer(module,loadPresetSound(preset,layer)))}/>
  </>;
}
