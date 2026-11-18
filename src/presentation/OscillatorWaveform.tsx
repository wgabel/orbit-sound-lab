import { useEffect, useRef } from 'react';

interface OscillatorWaveformProps {
  readonly oscillatorId: string;
  readonly playing: boolean;
  readonly enabled: boolean;
  readonly getAnalyser: (oscillatorId: string) => AnalyserNode | null;
}

/** Draws real post-filter, post-amplitude samples without React render updates. */
export function OscillatorWaveform({oscillatorId, playing, enabled, getAnalyser}: OscillatorWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !playing || !enabled) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let visible = true;
    let frame = 0;
    let lastDraw = 0;
    let samples = new Float32Array(2048);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
    });
    observer?.observe(canvas);
    const draw = (timestamp: number) => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || timestamp - lastDraw < 33) return;
      lastDraw = timestamp;
      const analyser = getAnalyser(oscillatorId);
      if (!analyser) return;
      if (samples.length !== analyser.fftSize) samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples as Float32Array<ArrayBuffer>);
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.clearRect(0, 0, width, height);
      context.strokeStyle = '#344c53';
      context.lineWidth = ratio;
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();
      // Trigger at a positive-going zero crossing for a stable display.
      let start = 0;
      for (let index = 1; index < samples.length / 2; index++) {
        if (samples[index - 1] <= 0 && samples[index] > 0) { start = index; break; }
      }
      const available = samples.length - start;
      context.beginPath();
      context.strokeStyle = '#80e6cb';
      context.lineWidth = 1.6 * ratio;
      for (let x = 0; x < width; x++) {
        const index = start + Math.min(available - 1, Math.floor(x / width * available));
        const y = height / 2 - Math.max(-1, Math.min(1, samples[index])) * height * 0.43;
        if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); context.clearRect(0, 0, canvas.width, canvas.height); };
  }, [oscillatorId, playing, enabled, getAnalyser]);
  return <div className="oscillator-waveform" aria-label={`Live audio waveform for ${oscillatorId}`}>
    <span className="oscillator-waveform-label">LIVE WAVEFORM</span>
    <canvas ref={canvasRef} aria-hidden="true"/>
    {!playing || !enabled ? <span className="oscillator-waveform-idle">{playing ? 'OSC OFF' : 'STANDBY'}</span> : null}
  </div>;
}
