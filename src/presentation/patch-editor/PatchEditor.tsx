import { useCallback, useEffect, useRef, useState } from 'react';
import type { DroneLayer, DroneLayerId } from '../../domain/drone-layers';
import type { PatchPlayback } from '../../application/patch-playback';
import { connectPatchPorts, copyDroneLayerToPatch, createExamplePatch, createPatchModule, getPatchPort, hasPatchCycle,
  MODULE_LABELS, sameEndpoint, validatePatch } from '../../domain/patch';
import type { CableMapping, Patch, PatchDrone, PatchEndpoint, PatchModule, PatchModuleKind, PatchPort } from '../../domain/patch';
import { createExampleLayout, PatchCanvas } from './PatchCanvas';
import type { PatchSelection } from './PatchCanvas';
import { placeNewPatchNode } from './patch-layout';
import type { PatchLayout } from './patch-layout';
import { PatchInspector } from './PatchInspector';
import './patch-editor.css';

export function PatchEditor({hidden, droneLayers, onClose, createPlayback}: {
  hidden: boolean;
  readonly droneLayers: Readonly<Record<DroneLayerId, DroneLayer>>;
  onClose(): void;
  createPlayback(): PatchPlayback;
}) {
  const engine = useRef<PatchPlayback | null>(null);
  const nextId = useRef(1);
  const viewport = useRef<HTMLDivElement>(null);
  const [patch, setPatch] = useState(createExamplePatch);
  const [positions, setPositions] = useState<PatchLayout>(createExampleLayout);
  const [selection, setSelection] = useState<PatchSelection | null>({kind:'cable',id:'filter-control'});
  const [pending, setPending] = useState<PatchEndpoint | null>(null);
  const [message, setMessage] = useState('Select an output, then a highlighted input to connect it.');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [transition, setTransition] = useState(false);
  const [outputLevel, setOutputLevel] = useState(0);
  const readAudibleElapsed = useCallback(() => engine.current?.readAudibleElapsed() ?? 0, []);

  useEffect(() => () => {engine.current?.dispose(); engine.current = null;}, []);
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      const playback = engine.current;
      if (playback) setOutputLevel(playback.readOutputLevel());
    }, 80);
    return () => window.clearInterval(interval);
  }, [playing]);

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
    if (close && !playing) {onClose(); return;}
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
      if (close) onClose();
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
    const id = `cable-${nextId.current++}`;
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
    const id = `module-${nextId.current++}`;
    const module = createPatchModule(kind,id);
    const position = viewport.current ? placeNewPatchNode(viewport.current,module) : {x:28,y:38};
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
    const snapshot = copyDroneLayerToPatch(module,layerId,droneLayers[layerId]);
    if (apply({...patch, modules:patch.modules.map(item => item.id === module.id ? snapshot : item)})) {
      setMessage(`Copied Drone ${layerId} into this node.`);
    }
  }

  function updateMapping(id: string, mapping: CableMapping) {
    apply({...patch,cables:patch.cables.map(cable => cable.id === id ? {...cable,mapping} : cable)});
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

  function loadPatch(example: boolean) {
    if (!apply(example ? createExamplePatch() : {version:1,modules:[],cables:[]})) return;
    setPositions(example ? createExampleLayout() : {});
    setPending(null);
    setSelection(example ? {kind:'cable',id:'filter-control'} : null);
    setMessage(example ? 'Example loaded. Play to hear the stepped drone.' : 'Add a module to start patching.');
  }

  return <main className="patch-editor" hidden={hidden} onKeyDown={event => {
    if (event.key !== 'Escape' || !pending) return;
    setPending(null);
    setMessage('Cable cancelled.');
  }}>
    <header className="patch-heading">
      <div><span>ORBIT SOUND LAB</span><h1>Patch editor</h1></div>
      <div className="patch-actions">
        <button type="button" className="patch-play" disabled={transition} onClick={() => void togglePlayback()}>
          {transition ? 'Please wait' : playing ? 'Stop patch' : 'Play patch'}</button>
        <button type="button" disabled={transition} onClick={() => void togglePlayback(true)}>Drone editor</button>
      </div>
    </header>
    <div inert={transition}>
      <div className="patch-toolbar">
        <select aria-label="Add module" value="" onChange={event => addModule(event.target.value as PatchModuleKind)}>
          <option value="" disabled>Add module</option>
          {Object.entries(MODULE_LABELS).map(([kind,label]) => <option key={kind} value={kind}>{label}</option>)}
        </select>
        <button type="button" onClick={() => loadPatch(true)}>Load example</button>
        <button type="button" onClick={() => loadPatch(false)}>Empty patch</button>
        <span className="patch-legend"><span>Audio</span><span>Automation</span></span>
      </div>
      <PatchCanvas viewportRef={viewport} patch={patch} positions={positions} selection={selection} pending={pending}
        playing={playing} readAudibleElapsed={readAudibleElapsed} outputLevel={outputLevel}
        onPort={handlePort} canConnect={canConnect}
        onSelect={item => {setSelection(item); setPending(null); setError('');}}
        onMove={(id,position) => setPositions(previous => ({...previous,[id]:position}))}/>
      <p className="patch-status" role={error ? 'alert' : 'status'}>{error || message}</p>
      <PatchInspector patch={patch} selection={selection} onModule={updateModule} onCopyDrone={copyDrone} onMapping={updateMapping} onRemove={remove}/>
    </div>
  </main>;
}
