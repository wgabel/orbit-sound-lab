export const MINIMUM_PATCH_ZOOM = 50;
export const MAXIMUM_PATCH_ZOOM = 200;
export const PATCH_ZOOM_STEP = 25;

export function PatchViewControls({zoom, expanded, onZoom, onToggleExpanded}: {
  readonly zoom: number;
  readonly expanded: boolean;
  onZoom(zoom: number): void;
  onToggleExpanded(): void;
}) {
  const expandLabel = expanded ? 'Restore editor size' : 'Expand editor';
  return <div className="patch-view-controls" role="group" aria-label="Canvas view">
    <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= MINIMUM_PATCH_ZOOM}
      onClick={() => onZoom(zoom - PATCH_ZOOM_STEP)}>−</button>
    <output aria-label="Current zoom">{zoom}%</output>
    <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= MAXIMUM_PATCH_ZOOM}
      onClick={() => onZoom(zoom + PATCH_ZOOM_STEP)}>+</button>
    <button type="button" aria-label={expandLabel} title={expandLabel} aria-pressed={expanded} onClick={onToggleExpanded}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={expanded ? 'M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5'}/>
      </svg>
    </button>
  </div>;
}
