import { useState } from 'react';
import type { CSSProperties } from 'react';
import { duplicateArrangementSection, isArrangementTrack, MAX_ARRANGEMENT_SECONDS, MIN_CLIP_SECONDS,
  readArrangementEnd } from '@domain/patch/arrangement';
import type { ArrangementClip, ArrangementSection, PatchArrangement } from '@domain/patch/arrangement';
import { getPatchModuleLabel } from '@domain/patch';
import type { Patch } from '@domain/patch';
import { AutomationSettings } from '@presentation/patch-editor/inspector/modules/control/AutomationSettings';

interface TimelineProps {
  readonly patch: Patch;
  readonly arrangement: PatchArrangement;
  readonly playing: boolean;
  readonly canPlay: boolean;
  readonly elapsed: number;
  onChange(arrangement: PatchArrangement): boolean;
  onPlay(from: number): void;
  onStop(): void;
}

function formatTime(seconds: number): string {
  const rounded = Math.round(seconds*10)/10;
  return `${Math.floor(rounded/60)}:${(rounded%60).toFixed(1).padStart(4,'0')}`;
}

function NumberField({label,value,min = 0,max = MAX_ARRANGEMENT_SECONDS,onCommit}: {
  label: string; value: number; min?: number; max?: number; onCommit(value: number): void;
}) {
  return <label>{label}<input type="number" inputMode="decimal" key={value} defaultValue={value}
    min={min} max={max} step="any" onBlur={event => {
      const input = event.currentTarget;
      if (input.validity.valid && Number.isFinite(input.valueAsNumber) && input.valueAsNumber !== value) {
        onCommit(input.valueAsNumber);
      }
      input.value = String(value);
    }} onKeyDown={event => {
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key === 'Escape') {event.currentTarget.value = String(value); event.currentTarget.blur();}
    }}/></label>;
}

export function PatchArrangementTimeline({patch,arrangement,playing,canPlay,elapsed,onChange,onPlay,onStop}: TimelineProps) {
  const [moduleId,setModuleId] = useState('');
  const [selection,setSelection] = useState('');
  const [cue,setCue] = useState(0);
  const tracks = patch.modules.filter(isArrangementTrack);
  const chosenModule = tracks.find(module => module.id === moduleId) ?? tracks[0];
  const labels = new Map(tracks.map(module => {
    const label = getPatchModuleLabel(module);
    const matching = tracks.filter(track => getPatchModuleLabel(track) === label);
    const customName = arrangement.trackNames && Object.hasOwn(arrangement.trackNames,module.id)
      ? arrangement.trackNames[module.id] : undefined;
    return [module.id,customName ?? (matching.length > 1 ? `${label} ${matching.indexOf(module)+1}` : label)];
  }));
  const selectedClip = arrangement.clips.find(clip => clip.id === selection);
  const selectedSection = arrangement.sections.find(section => section.id === selection);
  const clipModule = selectedClip && tracks.find(module => module.id === selectedClip.moduleId);
  const end = readArrangementEnd(arrangement);
  const fullDuration = end + arrangement.tail;
  const rulerDuration = Math.max(10,Math.ceil(fullDuration/5)*5);
  const position = Math.min(cue,Math.max(0,end-MIN_CLIP_SECONDS));
  const playhead = playing ? Math.min(elapsed,fullDuration) : position;
  const ticks = Array.from({length:6},(_,index) => rulerDuration*index/5);
  const rows = tracks.filter(module => arrangement.clips.some(clip => clip.moduleId === module.id));
  const id = () => crypto.randomUUID();

  function spanStyle(span: {start: number; duration: number}): CSSProperties {
    return {left:`${100*span.start/rulerDuration}%`,width:`${100*span.duration/rulerDuration}%`};
  }

  function updateClip(clip: ArrangementClip) {
    onChange({...arrangement,clips:arrangement.clips.map(item => item.id === clip.id ? clip : item)});
  }

  function updateSection(section: ArrangementSection) {
    onChange({...arrangement,sections:arrangement.sections.map(item => item.id === section.id ? section : item)});
  }

  function addClip() {
    if (!chosenModule) return;
    let start = position;
    let available = MAX_ARRANGEMENT_SECONDS;
    for (const existing of arrangement.clips.filter(clip => clip.moduleId === chosenModule.id)) {
      if (existing.start - start >= MIN_CLIP_SECONDS) {
        available = existing.start;
        break;
      }
      start = Math.max(start,existing.start+existing.duration);
    }
    const duration = Math.min(5,available-start);
    const fade = Math.min(0.1,duration/2);
    const clip: ArrangementClip = {id:id(),moduleId:chosenModule.id,start,duration,fadeIn:fade,fadeOut:fade,level:1};
    if (onChange({...arrangement,clips:[...arrangement.clips,clip]})) setSelection(clip.id);
  }

  function addSection() {
    const start = Math.max(0,...arrangement.sections.map(section => section.start + section.duration));
    const section: ArrangementSection = {id:id(),name:`Section ${arrangement.sections.length+1}`,start,duration:10};
    if (onChange({...arrangement,sections:[...arrangement.sections,section]})) setSelection(section.id);
  }

  return <section className="patch-arrangement" aria-label="Arrangement timeline">
    <div className="patch-inspector-header">
      <h2>Arrangement timeline</h2>
      <output aria-label="Arrangement playback time">{formatTime(playhead)} / {formatTime(fullDuration)}</output>
    </div>
    <div className="patch-actions arrangement-transport">
      {playing ? <button type="button" onClick={onStop}>Stop arrangement</button> : <>
        <button type="button" disabled={!canPlay || !arrangement.clips.length} onClick={() => onPlay(0)}>Play from start</button>
        <button type="button" disabled={!canPlay || !arrangement.clips.length} onClick={() => onPlay(position)}>Play from cursor</button>
      </>}
      <label>Start cursor
        <input type="range" min={0} max={Math.max(0,end-MIN_CLIP_SECONDS)} step="any" value={position}
          disabled={playing || !end} onChange={event => setCue(event.target.valueAsNumber)}/>
      </label>
      <fieldset className="arrangement-actions" disabled={playing}>
        <NumberField label="Cursor (s)" value={position} max={Math.max(0,end-MIN_CLIP_SECONDS)} onCommit={setCue}/>
        <NumberField label="Effect tail (s)" value={arrangement.tail} max={30}
          onCommit={tail => onChange({...arrangement,tail})}/>
      </fieldset>
    </div>
    <fieldset disabled={playing} className="arrangement-actions">
      <label>Clip source<select value={chosenModule?.id ?? ''} onChange={event => setModuleId(event.target.value)}>
        {!tracks.length && <option value="">Add a source node first</option>}
        {tracks.map(module => <option key={module.id} value={module.id}>{labels.get(module.id)}</option>)}
      </select></label>
      <button type="button" disabled={!chosenModule} onClick={addClip}>Add clip</button>
      <button type="button" onClick={addSection}>Add section</button>
    </fieldset>
    {!arrangement.clips.length && <p>Choose a source and add a clip to hear it in the arrangement.</p>}
    <div className="arrangement-scroll">
      <div className="arrangement-grid">
        <div>Seconds</div>
        <div className="arrangement-ruler">
          {ticks.map(time => <span key={time}>{time}</span>)}
        </div>
        <div>Sections</div>
        <div className="arrangement-lane">
          {arrangement.sections.map(section => <button type="button" key={section.id} title={section.name}
            style={spanStyle(section)} aria-pressed={section.id === selection} onClick={() => setSelection(section.id)}>
            {section.name}</button>)}
        </div>
        {rows.map(module => <div className="arrangement-track" key={module.id} data-signal={(module.kind === 'automation' || module.kind === 'chordProgression') ? 'control' : 'audio'}>
          <span>{labels.get(module.id)}</span>
          <div className="arrangement-lane">
            {arrangement.clips.filter(clip => clip.moduleId === module.id).map(clip => {
              const label = `${labels.get(module.id)} at ${formatTime(clip.start)}`;
              return <button type="button" key={clip.id} title={label} aria-label={label} aria-pressed={clip.id === selection}
                style={spanStyle(clip)} onClick={() => setSelection(clip.id)}>{formatTime(clip.start)}</button>;
            })}
          </div>
        </div>)}
        <div className="arrangement-cursor-track" aria-hidden="true">
          <span style={{left:`${100*playhead/rulerDuration}%`}}/>
        </div>
      </div>
    </div>
    {selectedSection && <fieldset className="arrangement-details" disabled={playing}>
      <legend>Section</legend>
      <div className="arrangement-actions">
        <label>Name<input key={selectedSection.name} defaultValue={selectedSection.name} maxLength={60}
          onBlur={event => {
            const name = event.currentTarget.value.trim();
            if (name && name !== selectedSection.name) updateSection({...selectedSection,name});
            event.currentTarget.value = selectedSection.name;
          }} onKeyDown={event => {if (event.key === 'Enter') event.currentTarget.blur();}}/></label>
        <NumberField label="Section starts (s)" value={selectedSection.start} onCommit={start => updateSection({...selectedSection,start})}/>
        <NumberField label="Section length (s)" min={MIN_CLIP_SECONDS} value={selectedSection.duration}
          onCommit={duration => updateSection({...selectedSection,duration})}/>
        <button type="button" onClick={() => onChange(duplicateArrangementSection(arrangement,selectedSection,id))}>Duplicate section at end</button>
        <button type="button" onClick={() => onChange({...arrangement,sections:arrangement.sections.filter(item => item.id !== selection)})}>Remove section label</button>
      </div>
    </fieldset>}
    {selectedClip && clipModule && <fieldset className="arrangement-details" disabled={playing}>
      <legend>{labels.get(clipModule.id)} clip</legend>
      <div className="arrangement-actions">
        <label>Track name<input key={clipModule.id + labels.get(clipModule.id)} maxLength={60}
          defaultValue={labels.get(clipModule.id)} onBlur={event => {
            const label = event.currentTarget.value.trim();
            if (label && label !== labels.get(clipModule.id)) {
              onChange({...arrangement,trackNames:{...arrangement.trackNames,[clipModule.id]:label}});
            }
            event.currentTarget.value = labels.get(clipModule.id) ?? '';
          }} onKeyDown={event => {if (event.key === 'Enter') event.currentTarget.blur();}}/></label>
        <NumberField label="Clip starts (s)" value={selectedClip.start} onCommit={start => updateClip({...selectedClip,start})}/>
        <NumberField label="Clip length (s)" value={selectedClip.duration} min={MIN_CLIP_SECONDS}
          onCommit={duration => updateClip({...selectedClip,duration,fadeIn:Math.min(selectedClip.fadeIn,duration/2),fadeOut:Math.min(selectedClip.fadeOut,duration/2)})}/>
        <NumberField label="Fade in (s)" value={selectedClip.fadeIn} max={selectedClip.duration-selectedClip.fadeOut}
          onCommit={fadeIn => updateClip({...selectedClip,fadeIn})}/>
        <NumberField label="Fade out (s)" value={selectedClip.fadeOut} max={selectedClip.duration-selectedClip.fadeIn}
          onCommit={fadeOut => updateClip({...selectedClip,fadeOut})}/>
        <NumberField label={(clipModule.kind === 'automation' || clipModule.kind === 'chordProgression') ? 'Strength (%)' : 'Level (%)'} value={selectedClip.level*100} max={100}
          onCommit={level => updateClip({...selectedClip,level:level/100})}/>
        {(clipModule.kind === 'automation' || clipModule.kind === 'chordProgression') && <label>
          {clipModule.kind === 'automation' ? 'Curve phase' : 'Progression phase'}
          <select value={selectedClip.phase ?? 'restart'} onChange={event => updateClip({...selectedClip,
            phase:event.target.value === 'continue' ? 'continue' : 'restart'})}>
            <option value="restart">Restart on entry</option><option value="continue">Follow arrangement clock</option>
          </select>
        </label>}
        <button type="button" onClick={() => {
          const duplicate = {...selectedClip,id:id(),start:Math.max(...arrangement.clips
            .filter(clip => clip.moduleId === selectedClip.moduleId).map(clip => clip.start+clip.duration))};
          if (onChange({...arrangement,clips:[...arrangement.clips,duplicate]})) setSelection(duplicate.id);
        }}>Duplicate clip</button>
        <button type="button" onClick={() => onChange({...arrangement,clips:arrangement.clips.filter(item => item.id !== selection)})}>Remove clip</button>
      </div>
      {clipModule.kind === 'automation' && <>
        <label className="arrangement-variation"><input type="checkbox" checked={Boolean(selectedClip.automation)}
          onChange={event => updateClip({...selectedClip,automation:event.target.checked ? structuredClone(clipModule.settings) : undefined})}/>
          Use a separate curve for this clip</label>
        {selectedClip.automation && <AutomationSettings settings={selectedClip.automation}
          onChange={automation => updateClip({...selectedClip,automation})}/>}
      </>}
    </fieldset>}
  </section>;
}
