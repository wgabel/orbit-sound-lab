import { AUTOMATION_PRESET_NAME_LIMIT } from '../../domain/automation-preset';
import type { PatchAutomation } from '../../domain/patch-automation';
import { deleteAutomationPreset, exportAutomationPreset, importAutomationPreset,
  listAutomationPresets, saveAutomationPreset } from '../../infrastructure/storage/automation-preset-library';
import { PresetLibrary } from './PresetLibrary';

export function AutomationPresetLibrary({settings, onLoad}: {
  readonly settings: PatchAutomation;
  onLoad(settings: PatchAutomation): void;
}) {
  return <PresetLibrary label="Automation" nameLimit={AUTOMATION_PRESET_NAME_LIMIT} list={listAutomationPresets}
    save={name => saveAutomationPreset(name,settings)} importFile={importAutomationPreset} exportFile={exportAutomationPreset}
    remove={deleteAutomationPreset} onLoad={preset => onLoad(structuredClone(preset.automation))}/>;
}
