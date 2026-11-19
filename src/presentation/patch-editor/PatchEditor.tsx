import { EMPTY_PATCH_ARRANGEMENT, readArrangementEnd, readPatchArrangement } from '../../domain/patch-arrangement';
import type { PatchArrangement } from '../../domain/patch-arrangement';
import { PatchArrangementTimeline } from './PatchArrangementTimeline';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DroneLayer, DroneLayerId } from '../../domain/drone-layers';
import type { PatchPlayback } from '../../application/patch-playback';
import { canConnectPatchPorts, connectPatchPorts, createExamplePatch, createPatchModule, getInputCable, getPatchPort,
  MODULE_LABELS, sameEndpoint, setPatchDroneLayer, validatePatch } from '../../domain/patch';
import type { CableMapping, PatchCable, NodePosition, PatchLayout, Patch, PatchDrone, PatchEndpoint, PatchModule, PatchModuleKind, PatchPort } from '../../domain/patch';
import { createExampleLayout, PatchCanvas } from './PatchCanvas';
import type { PatchSelection } from './PatchCanvas';
import { getPatchScrollOffset, getVisiblePatchViewport, getZoomedCanvasOrigin, placeNewPatchNode, readPatchViewportOrigin } from './patch-layout';
import { PatchInspector } from './PatchInspector';
import { FACTORY_PATCH_GROUPS } from '../../domain/factory-patch-presets';
import { PATCH_PRESET_NAME_LIMIT } from '../../domain/patch-preset';
import type { PatchPreset, PatchSnapshot } from '../../domain/patch-preset';
import { deletePatchPreset, exportPatchPreset, importPatchPreset, listPatchPresets, savePatchPreset } from '../../infrastructure/storage/patch-preset-library';
import { PresetLibraryPanel } from './PresetLibrary';
import { usePresetCollection } from '../usePresetCollection';
import { PatchViewControls } from './PatchViewControls';
import { resolvePatchOverlaps } from './patch-overlap';
import './patch-editor.css';
import './patch-arrangement.css';

export function PatchEditor({hidden, droneLayers, onClose, onEditDrone, createPlayback}: {
  hidden: boolean;
  readonly droneLayers: Readonly<Record<DroneLayerId, DroneLayer>>;
  onClose(): void;
  onEditDrone(module: PatchDrone, applyEdits: (layer: DroneLayer) => boolean): void;
  createPlayback(): PatchPlayback;
}) {
  const engine = useRef<PatchPlayback | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pendingViewport = useRef<NodePosition | null>({x:0,y:0});
  const [patch, setPatch] = useState(createExamplePatch);
  const presetCollection = usePresetCollection(listPatchPresets);
  const [positions, setPositions] = useState<PatchLayout>(createExampleLayout);
  const [selection, setSelection] = useState<PatchSelection | null>({kind:'cable',id:'filter-control'});
  const [pending, setPending] = useState<PatchEndpoint | null>(null);
  const [message, setMessage] = useState('Select an output, then a highlighted input to connect it.');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [arrangement, setArrangement] = useState<PatchArrangement>(EMPTY_PATCH_ARRANGEMENT);
  const [showArrangement, setShowArrangement] = useState(false);
  const [arrangementPlaying, setArrangementPlaying] = useState(false);
  const [arrangementElapsed, setArrangementElapsed] = useState(0);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const transportBusy = useRef(false);
  const arrangementEnd = readArrangementEnd(arrangement) + arrangement.tail;
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const scale = zoom / 100;
  const [transition, setTransition] = useState(false);
  const [outputLevel, setOutputLevel] = useState(0);
  const readLfoPhase = useCallback((moduleId: string, elapsed: number) => engine.current?.readLfoPhase(moduleId,elapsed), []);
  const readAutomationTiming = useCallback((moduleId: string, elapsed: number) =>
    engine.current?.readAutomationTiming(moduleId,elapsed), []);
  const readControlValue = useCallback((moduleId: string) => engine.current?.readControlValue(moduleId), []);
  const getWaveformAnalyser = useCallback((moduleId: string) =>
    engine.current?.getWaveformAnalyser(moduleId) ?? null, []);
  const readAudibleElapsed = useCallback(() => engine.current?.readAudibleElapsed() ?? 0, []);

  useEffect(() => () => {engine.current?.dispose(); engine.current = null;}, []);
  async function saveSnapshot() {
    try {
      const saved = await presetCollection.update(() => saveCurrentPatch(`Patch ${new Date().toLocaleString()}`));
      if (!saved) return;
      setError('');
      setMessage('Patch snapshot saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save patch snapshot.');
    }
  }
  const stopPlayback = useCallback(async (): Promise<boolean> => {
    if (transportBusy.current) return false;
    transportBusy.current = true;
    setTransition(true);
    try {
      await engine.current?.stop();
      setPlaying(false);
      setArrangementPlaying(false);
      setOutputLevel(0);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not stop playback.');
      return false;
    } finally {
      transportBusy.current = false;
      setTransition(false);
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      const playback = engine.current;
      if (!playback) return;
      if (!showArrangement) setOutputLevel(playback.readOutputLevel());
      if (!arrangementPlaying) return;
      const elapsed = playback.readAudibleElapsed();
      setArrangementElapsed(elapsed);
      if (elapsed >= arrangementEnd) {
        window.clearInterval(interval);
        void stopPlayback().then(stopped => {if (stopped) setMessage('Arrangement finished.');});
      }
    }, 80);
    return () => window.clearInterval(interval);
  }, [playing, showArrangement, arrangementPlaying, arrangementEnd, stopPlayback]);

  useLayoutEffect(() => {
    const position = pendingViewport.current;
    if (!position || !viewport.current || hidden || showArrangement) return;
    const offset = getPatchScrollOffset(position,scale);
    viewport.current.scrollTo(offset.x,offset.y);
    pendingViewport.current = null;
  }, [positions, scale, hidden, showArrangement]);

  function changeZoom(nextZoom: number) {
    const element = viewport.current;
    if (element) {
      const visible = getVisiblePatchViewport(element);
      pendingViewport.current = getZoomedCanvasOrigin(readPatchViewportOrigin(element,scale),
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

  function toggleArrangementView() {
    if (!showArrangement && viewport.current) pendingViewport.current = readPatchViewportOrigin(viewport.current,scale);
    setShowArrangement(!showArrangement);
  }

  function updateArrangement(next: PatchArrangement): boolean {
    try {
      setArrangement(readPatchArrangement(next,patch));
      setError('');
      setMessage('');
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the arrangement.');
      return false;
    }
  }

  async function togglePlayback(close = false, from?: number) {
    if (transportBusy.current) return;
    setError('');
    if (close || playing) {
      if ((!playing || await stopPlayback()) && close) closeEditor();
      return;
    }

    transportBusy.current = true;
    setTransition(true);
    try {
      const playback = engine.current ?? createPlayback();
      engine.current = playback;
      await playback.start(patch,from === undefined ? undefined : {plan:arrangement,from});
      if (engine.current !== playback) return;
      setArrangementElapsed(from ?? 0);
      setArrangementPlaying(from !== undefined);
      setPlaying(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not play the patch.');
    } finally {
      transportBusy.current = false;
      setTransition(false);
    }
  }

  function canConnect(destination: PatchEndpoint): boolean {
    return Boolean(pending && canConnectPatchPorts(patch,pending,destination));
  }

  function handlePort(endpoint: PatchEndpoint, port: PatchPort) {
    setError('');
    if (port.direction === 'output') {
      const next = pending && sameEndpoint(pending,endpoint) ? null : endpoint;
      setPending(next);
      setMessage(next ? 'Choose an input. Connecting to an occupied input replaces its cable. Escape cancels.' : 'Cable cancelled.');
      return;
    }
    if (!pending) {
      setMessage('Select an output first.');
      return;
    }
    const id = `cable-${crypto.randomUUID()}`;
    try {
      const existing = getInputCable(patch,endpoint);
      const next = connectPatchPorts(patch,id,pending,endpoint);
      if (next !== patch && !apply(next)) return;
      setPending(null);
      setSelection({kind:'cable',id:next === patch && existing ? existing.id : id});
      setMessage(next === patch ? 'This cable is already connected.' : existing ? 'Cable replaced.' : 'Cable connected.');
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

  function cleanUpOverlaps() {
    if (!viewport.current) return;
    const sizes = new Map(Array.from(viewport.current.querySelectorAll<HTMLElement>('[data-node-id]'), node => {
      const {width,height} = node.getBoundingClientRect();
      return [node.dataset.nodeId ?? '',{width:width/scale,height:height/scale}];
    }));
    const next = resolvePatchOverlaps(positions,sizes);
    setPositions(next);
    setMessage(next === positions ? 'No node overlaps to clean up.' : 'Overlapping nodes moved to nearby spaces.');
  }

  function updateModule(module: PatchModule) {
    const next = {...patch,modules:patch.modules.map(item => item.id === module.id ? module : item)};
    const cables = patch.cables.filter(cable => getPatchPort(next,cable.source) && getPatchPort(next,cable.destination));
    if (apply({...next,cables}) && cables.length !== patch.cables.length) setMessage('Disconnected a port the new waveform does not support.');
  }

  async function editDrone(module: PatchDrone) {
    if (transportBusy.current || (playing && !await stopPlayback())) return;
    if (viewport.current) pendingViewport.current = readPatchViewportOrigin(viewport.current,scale);
    setPending(null);
    onEditDrone(module,layer => {
      const edited = setPatchDroneLayer(module,layer,module.settings.copiedFrom);
      const next = {...patch,modules:patch.modules.map(item => item.id === module.id ? edited : item)};
      if (!apply(next)) return false;
      setMessage('Drone node updated.');
      return true;
    });
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
    if (item.kind === 'module') setArrangement(previous => ({
      ...previous,clips:previous.clips.filter(clip => clip.moduleId !== item.id),
      trackNames:previous.trackNames && Object.fromEntries(Object.entries(previous.trackNames).filter(([id]) => id !== item.id))
    }));
    setPending(null);
    setSelection(null);
    setMessage(item.kind === 'module' ? 'Module removed.' : 'Cable disconnected.');
  }

  function loadNamedPatch(preset: PatchSnapshot & {readonly name: string}) {
    const snapshot = structuredClone(preset);
    if (!apply(snapshot.patch)) return;
    pendingViewport.current = snapshot.viewport;
    setArrangement(snapshot.arrangement ?? EMPTY_PATCH_ARRANGEMENT);
    setTimelineVersion(version => version+1);
    if (snapshot.arrangement?.clips.length) setShowArrangement(true);
    setPositions(snapshot.layout);
    setPending(null);
    setSelection(null);
    setMessage(`Loaded patch "${snapshot.name}".`);
  }

  function saveCurrentPatch(name: string) {
    return savePatchPreset(name,{patch,layout:positions,
      viewport:pendingViewport.current ?? (viewport.current ? readPatchViewportOrigin(viewport.current,scale) : {x:0,y:0}),
      ...(arrangement.clips.length || arrangement.sections.length || arrangement.trackNames || arrangement.tail !== EMPTY_PATCH_ARRANGEMENT.tail
        ? {arrangement} : {})});
  }

  function loadPatch(example: boolean) {
    if (!apply(example ? createExamplePatch() : {version:1,modules:[],cables:[]})) return;
    pendingViewport.current = {x:0,y:0};
    setArrangement(EMPTY_PATCH_ARRANGEMENT);
    setTimelineVersion(version => version+1);
    setShowArrangement(false);
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
          {!showArrangement && <button type="button" className="patch-play" disabled={transition} onClick={() => void togglePlayback()}>
            {transition ? 'Please wait' : playing ? (arrangementPlaying ? 'Stop arrangement' : 'Stop patch') : 'Play patch'}</button>}
          {showArrangement && playing && !arrangementPlaying && <button type="button" disabled={transition}
            onClick={() => void togglePlayback()}>Stop patch</button>}
          <button type="button" aria-pressed={showArrangement} onClick={toggleArrangementView} disabled={transition}>
            {showArrangement ? 'Patch canvas' : 'Arrangement'}</button>
          <button type="button" disabled={transition} onClick={() => void togglePlayback(true)}>Drone editor</button>
        </div>
        <PatchViewControls zoom={zoom} expanded={expanded} showZoom={!showArrangement} onZoom={changeZoom}
          onToggleExpanded={() => setExpanded(value => !value)}/>
      </div>
    </header>
    <div className="patch-workspace" inert={transition}>
      <div className="patch-toolbar" inert={arrangementPlaying}>
        <select disabled={showArrangement} aria-label="Add module" value="" onChange={event => addModule(event.target.value as PatchModuleKind)}>
          <option value="" disabled>Add module</option>
          <optgroup label="● Sound sources">
            {(['wave','drone','chord'] as const).map(kind =>
              <option key={kind} value={kind} className="patch-module-option-audio">● {MODULE_LABELS[kind]}</option>)}
          </optgroup>
          <optgroup label="◆ Automation sources">
            {(['lfo','simplexNoise','automation','chordProgression'] as const).map(kind =>
              <option key={kind} value={kind} className="patch-module-option-control">◆ {MODULE_LABELS[kind]}</option>)}
          </optgroup>
          <optgroup label="Audio processing &amp; routing">
            {(['filter','gain','shelfEq','reverb','mixer','crossfader','oscilloscope','pitchShift','output'] as const).map(kind =>
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
        <select aria-label="Saved patch preset" value="" disabled={presetCollection.busy}
          onChange={event => {
            const preset = presetCollection.presets.find(item => item.id === event.target.value);
            if (preset) loadNamedPatch(preset);
          }}>
          <option value="" disabled>My saved patches</option>
          {presetCollection.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
        <button type="button" disabled={presetCollection.busy} onClick={() => void saveSnapshot()}>Save snapshot</button>
        <button type="button" disabled={showArrangement || patch.modules.length < 2} onClick={cleanUpOverlaps}>Clean up overlaps</button>
        <button type="button" onClick={() => loadPatch(true)}>Load example</button>
        <button type="button" onClick={() => loadPatch(false)}>Empty patch</button>
        <span className="patch-legend"><span>Audio</span><span>Automation</span></span>
      </div>
      <details className="patch-presets" inert={arrangementPlaying}>
        <summary>My patch presets</summary>
        <PresetLibraryPanel<PatchPreset> label="Patch" nameLimit={PATCH_PRESET_NAME_LIMIT} showHeading={false} collection={presetCollection}
          save={saveCurrentPatch} importFile={importPatchPreset} exportFile={exportPatchPreset}
          remove={deletePatchPreset} onLoad={loadNamedPatch}/>
      </details>
      <div hidden={!showArrangement}>
        {!hidden && <PatchArrangementTimeline key={timelineVersion} patch={patch} arrangement={arrangement}
          playing={arrangementPlaying} canPlay={!playing} elapsed={arrangementElapsed} onChange={updateArrangement}
          onPlay={from => void togglePlayback(false,from)} onStop={() => void stopPlayback()}/>}
      </div>
      {showArrangement && (error || message) && <p className="patch-status" role={error ? 'alert' : 'status'}>{error || message}</p>}
      <div className="patch-workspace-content" hidden={showArrangement} inert={arrangementPlaying}>
        <PatchCanvas arrangement={arrangementPlaying ? arrangement : undefined} viewportRef={viewport} scale={scale} patch={patch} positions={positions} selection={selection} pending={pending}
          playing={playing} readAudibleElapsed={readAudibleElapsed} readLfoPhase={readLfoPhase} readAutomationTiming={readAutomationTiming} readControlValue={readControlValue} getWaveformAnalyser={getWaveformAnalyser} outputLevel={outputLevel}
          onPort={handlePort} canConnect={canConnect} onCableChange={updateCable}
          onSelect={item => {setSelection(item); setPending(null); setError('');}}
          onMove={(id,position) => setPositions(previous => {
            const current = previous[id];
            return current && (current.x !== position.x || current.y !== position.y)
              ? {...previous,[id]:position} : previous;
          })}/>
        <p className="patch-status" role={error ? 'alert' : 'status'}>{error || message}</p>
        {!hidden && <PatchInspector patch={patch} sampleRate={engine.current?.sampleRate} selection={selection} onModule={updateModule} onEditDrone={module => void editDrone(module)} onCopyDrone={copyDrone} onMapping={updateMapping} onRemove={remove}/>}
      </div>
    </div>
  </main>;
}
