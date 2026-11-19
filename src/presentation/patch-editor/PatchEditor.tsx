import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DroneLayer, DroneLayerId } from '../../domain/drone-layers';
import type { PatchPlayback } from '../../application/patch-playback';
import { connectPatchPorts, createExamplePatch, createPatchModule, getPatchPort, hasPatchCycle,
  MODULE_LABELS, sameEndpoint, setPatchDroneLayer, validatePatch } from '../../domain/patch';
import type { CableMapping, PatchCable, NodePosition, PatchLayout, Patch, PatchDrone, PatchEndpoint, PatchModule, PatchModuleKind, PatchPort } from '../../domain/patch';
import { createExampleLayout, PatchCanvas } from './PatchCanvas';
import type { PatchSelection } from './PatchCanvas';
import { getVisiblePatchViewport, getZoomedCanvasOrigin, placeNewPatchNode } from './patch-layout';
import { PatchInspector } from './PatchInspector';
import { FACTORY_PATCH_GROUPS } from '../../domain/factory-patch-presets';
import { PATCH_PRESET_NAME_LIMIT } from '../../domain/patch-preset';
import type { PatchPreset, PatchSnapshot } from '../../domain/patch-preset';
import { deletePatchPreset, exportPatchPreset, importPatchPreset, listPatchPresets, savePatchPreset } from '../../infrastructure/storage/patch-preset-library';
import { PresetLibrary } from './PresetLibrary';
import { PatchViewControls } from './PatchViewControls';
import './patch-editor.css';

export function PatchEditor({hidden, droneLayers, onClose, createPlayback}: {
  hidden: boolean;
  readonly droneLayers: Readonly<Record<DroneLayerId, DroneLayer>>;
  onClose(): void;
  createPlayback(): PatchPlayback;
}) {
  const engine = useRef<PatchPlayback | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pendingViewport = useRef<NodePosition | null>(null);
  const [patch, setPatch] = useState(createExamplePatch);
  const [savedPresets, setSavedPresets] = useState<PatchPreset[]>([]);
  const [positions, setPositions] = useState<PatchLayout>(createExampleLayout);
  const [selection, setSelection] = useState<PatchSelection | null>({kind:'cable',id:'filter-control'});
  const [pending, setPending] = useState<PatchEndpoint | null>(null);
  const [message, setMessage] = useState('Select an output, then a highlighted input to connect it.');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const scale = zoom / 100;
  const [transition, setTransition] = useState(false);
  const [outputLevel, setOutputLevel] = useState(0);
  const readLfoPhase = useCallback((moduleId: string, elapsed: number) => engine.current?.readLfoPhase(moduleId,elapsed), []);
  const readControlValue = useCallback((moduleId: string) => engine.current?.readControlValue(moduleId), []);
  const getWaveformAnalyser = useCallback((moduleId: string) =>
    engine.current?.getWaveformAnalyser(moduleId) ?? null, []);
  const readAudibleElapsed = useCallback(() => engine.current?.readAudibleElapsed() ?? 0, []);

  useEffect(() => () => {engine.current?.dispose(); engine.current = null;}, []);
  useEffect(() => {
    void listPatchPresets().then(setSavedPresets).catch(() => {});
  }, []);

  async function refreshSavedPresets() {
    setSavedPresets(await listPatchPresets());
  }

  async function saveSnapshot() {
    try {
      await saveCurrentPatch(`Patch ${new Date().toLocaleString()}`);
      await refreshSavedPresets();
      setError('');
      setMessage('Patch snapshot saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save patch snapshot.');
    }
  }
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      const playback = engine.current;
      if (playback) setOutputLevel(playback.readOutputLevel());
    }, 80);
    return () => window.clearInterval(interval);
  }, [playing]);

  useLayoutEffect(() => {
    const position = pendingViewport.current;
    if (!position || !viewport.current) return;
    viewport.current.scrollTo(position.x*scale,position.y*scale);
    pendingViewport.current = null;
  }, [positions, scale]);

  function changeZoom(nextZoom: number) {
    const element = viewport.current;
    if (element) {
      const visible = getVisiblePatchViewport(element);
      pendingViewport.current = getZoomedCanvasOrigin({x:element.scrollLeft,y:element.scrollTop},
        {x:visible.x + visible.width/2,y:visible.y + visible.height/2},scale,nextZoom/100);
    }
    setZoom(nextZoom);
  }

  function closeEditor() {
    setExpanded(false);
    onClose();
  }

  function apply(next: Patch): boolean {
    try {
      if (engine.current) engine.current.update(next);
      else validatePatch(next);
      setPatch(next);
      setError('');
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the patch.');
      return false;
    }
  }

  async function togglePlayback(close = false) {
    if (transition) return;
    if (close && !playing) {closeEditor(); return;}
    setTransition(true);
    setError('');
    try {
      if (playing) {
        await engine.current?.stop();
        setPlaying(false);
        setOutputLevel(0);
      } else {
        const playback = engine.current ?? createPlayback();
        engine.current = playback;
        await playback.start(patch);
        if (engine.current !== playback) return;
        setPlaying(true);
      }
      if (close) closeEditor();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not play the patch.');
    } finally {
      setTransition(false);
    }
  }

  function canConnect(destination: PatchEndpoint): boolean {
    if (!pending) return false;
    const input = getPatchPort(patch,destination);
    return input?.direction === 'input' && input.signal === getPatchPort(patch,pending)?.signal &&
      !patch.cables.some(cable => sameEndpoint(cable.destination,destination)) &&
      !hasPatchCycle([...patch.cables,{id:'pending',source:pending,destination}]);
  }

  function handlePort(endpoint: PatchEndpoint, port: PatchPort) {
    setError('');
    if (port.direction === 'output') {
      const next = pending && sameEndpoint(pending,endpoint) ? null : endpoint;
      setPending(next);
      setMessage(next ? 'Choose a highlighted input. Escape cancels the cable.' : 'Cable cancelled.');
      return;
    }
    if (!pending) {
      setMessage('Select an output first.');
      return;
    }
    const id = `cable-${crypto.randomUUID()}`;
    try {
      if (apply(connectPatchPorts(patch,id,pending,endpoint))) {
        setPending(null);
        setSelection({kind:'cable',id});
        setMessage('Cable connected.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not connect the cable.');
    }
  }

  function addModule(kind: PatchModuleKind) {
    const id = `module-${crypto.randomUUID()}`;
    const module = createPatchModule(kind,id);
    const position = viewport.current ? placeNewPatchNode(viewport.current,module,scale) : {x:28,y:38};
    if (!apply({...patch,modules:[...patch.modules,module]})) return;
    setPositions(previous => ({...previous,[id]:position}));
    setSelection({kind:'module',id});
    setPending(null);
  }

  function updateModule(module: PatchModule) {
    const next = {...patch,modules:patch.modules.map(item => item.id === module.id ? module : item)};
    const cables = patch.cables.filter(cable => getPatchPort(next,cable.source) && getPatchPort(next,cable.destination));
    if (apply({...next,cables}) && cables.length !== patch.cables.length) setMessage('Disconnected a port the new waveform does not support.');
  }

  function copyDrone(module: PatchDrone, layerId: DroneLayerId) {
    const snapshot = setPatchDroneLayer(module,droneLayers[layerId],layerId);
    if (apply({...patch, modules:patch.modules.map(item => item.id === module.id ? snapshot : item)})) {
      setMessage(`Copied Drone ${layerId} into this node.`);
    }
  }

  function updateMapping(id: string, mapping: CableMapping) {
    const cable = patch.cables.find(item => item.id === id);
    if (cable) updateCable({...cable,mapping});
  }

  function updateCable(cable: PatchCable) {
    apply({...patch,cables:patch.cables.map(item => item.id === cable.id ? cable : item)});
  }

  function remove(item: PatchSelection) {
    const next = item.kind === 'module' ? {
      ...patch,modules:patch.modules.filter(module => module.id !== item.id),
      cables:patch.cables.filter(cable => cable.source.moduleId !== item.id && cable.destination.moduleId !== item.id)
    } : {...patch,cables:patch.cables.filter(cable => cable.id !== item.id)};
    if (!apply(next)) return;
    if (item.kind === 'module') setPositions(previous => Object.fromEntries(
      Object.entries(previous).filter(([id]) => id !== item.id)));
    setPending(null);
    setSelection(null);
    setMessage(item.kind === 'module' ? 'Module removed.' : 'Cable disconnected.');
  }

  function loadNamedPatch(preset: PatchSnapshot & {readonly name: string}) {
    const snapshot = structuredClone(preset);
    if (!apply(snapshot.patch)) return;
    pendingViewport.current = snapshot.viewport;
    setPositions(snapshot.layout);
    setPending(null);
    setSelection(null);
    setMessage(`Loaded patch "${snapshot.name}".`);
  }

  function saveCurrentPatch(name: string) {
    return savePatchPreset(name,{patch,layout:positions,
      viewport:{x:(viewport.current?.scrollLeft ?? 0)/scale,y:(viewport.current?.scrollTop ?? 0)/scale}});
  }

  function loadPatch(example: boolean) {
    if (!apply(example ? createExamplePatch() : {version:1,modules:[],cables:[]})) return;
    setPositions(example ? createExampleLayout() : {});
    setPending(null);
    setSelection(example ? {kind:'cable',id:'filter-control'} : null);
    setMessage(example ? 'Example loaded. Play to hear the stepped drone.' : 'Add a module to start patching.');
  }

  return <main className="patch-editor" data-expanded={expanded} hidden={hidden} onKeyDown={event => {
    if (event.defaultPrevented || event.key !== 'Escape') return;
    if (pending) {
      setPending(null);
      setMessage('Cable cancelled.');
    } else if (expanded) setExpanded(false);
  }}>
    <header className="patch-heading">
      <div><span>ORBIT SOUND LAB</span><h1>Patch editor</h1></div>
      <div className="patch-actions">
        <div className="patch-transport">
          <button type="button" className="patch-play" disabled={transition} onClick={() => void togglePlayback()}>
            {transition ? 'Please wait' : playing ? 'Stop patch' : 'Play patch'}</button>
          <button type="button" disabled={transition} onClick={() => void togglePlayback(true)}>Drone editor</button>
        </div>
        <PatchViewControls zoom={zoom} expanded={expanded} onZoom={changeZoom}
          onToggleExpanded={() => setExpanded(value => !value)}/>
      </div>
    </header>
    <div className="patch-workspace" inert={transition}>
      <div className="patch-toolbar">
        <select aria-label="Add module" value="" onChange={event => addModule(event.target.value as PatchModuleKind)}>
          <option value="" disabled>Add module</option>
          <optgroup label="● Sound sources">
            {(['wave','drone','chord'] as const).map(kind =>
              <option key={kind} value={kind} className="patch-module-option-audio">● {MODULE_LABELS[kind]}</option>)}
          </optgroup>
          <optgroup label="◆ Automation sources">
            {(['lfo','automation'] as const).map(kind =>
              <option key={kind} value={kind} className="patch-module-option-control">◆ {MODULE_LABELS[kind]}</option>)}
          </optgroup>
          <optgroup label="Audio processing &amp; routing">
            {(['filter','gain','shelfEq','mixer','oscilloscope','pitchShift','output'] as const).map(kind =>
              <option key={kind} value={kind}>{MODULE_LABELS[kind]}</option>)}
          </optgroup>
        </select>
        <select aria-label="Factory patch preset" value="" onChange={event => {
          const preset = FACTORY_PATCH_GROUPS.flatMap(group => group.presets).find(item => item.id === event.target.value);
          if (preset) loadNamedPatch(preset);
        }}>
          <option value="" disabled>Factory patch presets</option>
          {FACTORY_PATCH_GROUPS.map(group => <optgroup key={group.label} label={group.label}>
            {group.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </optgroup>)}
        </select>
        <select aria-label="Saved patch preset" value="" onFocus={() => void refreshSavedPresets().catch(() => {})}
          onChange={event => {
            const preset = savedPresets.find(item => item.id === event.target.value);
            if (preset) loadNamedPatch(preset);
          }}>
          <option value="" disabled>My saved patches</option>
          {savedPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
        <button type="button" onClick={() => void saveSnapshot()}>Save snapshot</button>
        <button type="button" onClick={() => loadPatch(true)}>Load example</button>
        <button type="button" onClick={() => loadPatch(false)}>Empty patch</button>
        <span className="patch-legend"><span>Audio</span><span>Automation</span></span>
      </div>
      <details className="patch-presets">
        <summary>My patch presets</summary>
        <PresetLibrary<PatchPreset> label="Patch" nameLimit={PATCH_PRESET_NAME_LIMIT} showHeading={false} list={listPatchPresets}
          save={saveCurrentPatch} importFile={importPatchPreset} exportFile={exportPatchPreset}
          remove={deletePatchPreset} onLoad={loadNamedPatch} onLibraryChanged={() => void refreshSavedPresets()}/>
      </details>
      <div className="patch-workspace-content">
        <PatchCanvas viewportRef={viewport} scale={scale} patch={patch} positions={positions} selection={selection} pending={pending}
          playing={playing} readAudibleElapsed={readAudibleElapsed} readLfoPhase={readLfoPhase} readControlValue={readControlValue} getWaveformAnalyser={getWaveformAnalyser} outputLevel={outputLevel}
          onPort={handlePort} canConnect={canConnect} onCableChange={updateCable}
          onSelect={item => {setSelection(item); setPending(null); setError('');}}
          onMove={(id,position) => setPositions(previous => ({...previous,[id]:position}))}/>
        <p className="patch-status" role={error ? 'alert' : 'status'}>{error || message}</p>
        {!hidden && <PatchInspector patch={patch} sampleRate={engine.current?.sampleRate} selection={selection} onModule={updateModule} onCopyDrone={copyDrone} onMapping={updateMapping} onRemove={remove}/>}
      </div>
    </div>
  </main>;
}
