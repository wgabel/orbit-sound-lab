import { useState } from 'react';
import {
  ARRANGEMENT_FADE_IN_SECONDS, ARRANGEMENT_FADE_OUT_SECONDS, ARRANGEMENT_TAIL_SECONDS,
  getArrangementDuration, hasValidArrangementTimes, MAX_SCENE_DURATION_SECONDS
} from '../domain/sound-scene';
import type { ArrangementScene, SoundScene } from '../domain/sound-scene';

interface CapturedScene extends ArrangementScene {
  readonly id: number;
}

interface SceneTimelineProps {
  readonly captureSound: () => SoundScene;
  readonly onPlay: (scenes: readonly ArrangementScene[]) => void;
  readonly onStop: () => void;
  readonly playing: boolean;
  readonly blocked: boolean;
  readonly sceneIndex: number | null;
}

export function SceneTimeline({captureSound, onPlay, onStop, playing, blocked, sceneIndex}: SceneTimelineProps) {
  const [scenes, setScenes] = useState<readonly CapturedScene[]>([]);
  const [nextId, setNextId] = useState(1);
  const duration = getArrangementDuration(scenes);
  const validTimes = hasValidArrangementTimes(scenes);

  function captureScene() {
    const sound = captureSound();
    setScenes(current => [...current, {id: nextId, sound, holdSeconds: 15, blendSeconds: 12}]);
    setNextId(current => current + 1);
  }

  function moveScene(index: number, offset: number) {
    setScenes(current => {
      const reordered = [...current];
      [reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]];
      return reordered;
    });
  }

  function updateTime(id: number, parameter: 'holdSeconds' | 'blendSeconds', seconds: number) {
    setScenes(current => current.map(scene => scene.id === id ? {...scene, [parameter]: seconds} : scene));
  }

  return <section className="preset-morph scene-timeline" aria-labelledby="scene-timeline-title">
    <div className="preset-morph-heading">
      <h3 id="scene-timeline-title">Scene Timeline</h3>
      {scenes.length > 0 && validTimes && <span>About {Number(duration.toFixed(1))} s</span>}
    </div>
    <p>Capture the current sound of both drones, then set how long each scene holds and blends into the next.</p>
    <fieldset className="preset-morph-content" disabled={playing || blocked}>
      <div className="scene-timeline-actions">
        <button type="button" onClick={captureScene}>Capture current sound</button>
        <button type="button" disabled={!scenes.length || !validTimes}
          onClick={() => onPlay(scenes)}>Play arrangement</button>
      </div>
      <ol className="scene-timeline-list">
        {scenes.map((scene, index) => <li key={scene.id}>
          <strong>Scene {scene.id}</strong>
          <label>Hold (s)<input type="number" aria-label={`Hold for scene ${scene.id} in seconds`}
            min={0} max={MAX_SCENE_DURATION_SECONDS} step="any"
            value={Number.isFinite(scene.holdSeconds) ? scene.holdSeconds : ''}
            onChange={event => updateTime(scene.id, 'holdSeconds', event.target.valueAsNumber)}/></label>
          {index < scenes.length - 1 && <label>Blend to next (s)<input type="number"
            aria-label={`Blend from scene ${scene.id} in seconds`}
            min={0} max={MAX_SCENE_DURATION_SECONDS} step="any"
            value={Number.isFinite(scene.blendSeconds) ? scene.blendSeconds : ''}
            onChange={event => updateTime(scene.id, 'blendSeconds', event.target.valueAsNumber)}/></label>}
          <div className="scene-timeline-actions">
            <button type="button" aria-label={`Move scene ${scene.id} up`} disabled={index === 0}
              onClick={() => moveScene(index, -1)}>↑</button>
            <button type="button" aria-label={`Move scene ${scene.id} down`} disabled={index === scenes.length - 1}
              onClick={() => moveScene(index, 1)}>↓</button>
            <button type="button" aria-label={`Remove scene ${scene.id}`}
              onClick={() => setScenes(current => current.filter(item => item.id !== scene.id))}>Remove</button>
          </div>
        </li>)}
      </ol>
    </fieldset>
    {playing && <div className="scene-timeline-actions">
      <button type="button" onClick={onStop}>Stop arrangement</button>
      <span role="status">{sceneIndex === null ? 'Preparing scenes…' : `Scene ${scenes[sceneIndex]?.id}`}</span>
    </div>}
    {scenes.length > 0 && <p>Includes a {ARRANGEMENT_FADE_IN_SECONDS} s opening fade, a {ARRANGEMENT_FADE_OUT_SECONDS} s ending fade,
      and {ARRANGEMENT_TAIL_SECONDS} s for the effects tail. The timeline is kept until you reload the page.</p>}
  </section>;
}
