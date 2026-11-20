import type { AutomationPlaybackTiming } from '@domain/patch/automation';
import type { PatchArrangement } from '@domain/patch/arrangement';
import type {
  NodePosition,
  Patch,
  PatchCable,
  PatchEndpoint,
  PatchLayout,
  PatchPort
} from '@domain/patch';
import type { RefObject } from 'react';

export type PatchSelection = {
  readonly kind: 'module' | 'cable';
  readonly id: string;
};

/** Presentation boundary between the editor coordinator and the interactive canvas. */
export interface PatchCanvasProps {
  readonly patch: Patch;
  readonly arrangement?: PatchArrangement;
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly scale: number;
  readonly positions: PatchLayout;
  readonly selection: PatchSelection | null;
  readonly pending: PatchEndpoint | null;
  readonly playing: boolean;
  readonly outputLevel: number;
  readAudibleElapsed(): number;
  readLfoPhase(moduleId: string, elapsed: number): number | undefined;
  readAutomationTiming(moduleId: string, elapsed: number): AutomationPlaybackTiming | undefined;
  readControlValue(moduleId: string): number | undefined;
  getWaveformAnalyser(moduleId: string): AnalyserNode | null;
  onSelect(selection: PatchSelection): void;
  onCableChange(cable: PatchCable): void;
  onPort(endpoint: PatchEndpoint, port: PatchPort): void;
  canConnect(endpoint: PatchEndpoint): boolean;
  onMove(id: string, position: NodePosition): void;
}
