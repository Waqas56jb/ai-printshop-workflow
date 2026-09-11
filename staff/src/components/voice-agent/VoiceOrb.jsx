import { useEffect, useRef } from 'react';

/**
 * 3D reactive voice orb — CSS perspective + mic-driven intensity.
 */
export function VoiceOrb({ stream, status, muted }) {
  const rootRef = useRef(null);
  const levelRef = useRef(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    let raf = 0;
    let ctx;
    let analyser;
    let source;
    let data;

    const idle = status === 'off' || muted || !stream;
    if (idle) {
      const spin = () => {
        levelRef.current += (0.08 - levelRef.current) * 0.04;
        el.style.setProperty('--level', levelRef.current.toFixed(3));
        raf = requestAnimationFrame(spin);
      };
      spin();
      return () => cancelAnimationFrame(raf);
    }

    try {
      ctx = new AudioContext();
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      data = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      return undefined;
    }

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      const mid = Math.floor(data.length * 0.45);
      for (let i = 2; i < mid; i += 1) sum += data[i];
      const avg = sum / Math.max(1, mid - 2) / 255;
      const boost = status === 'speaking' ? 1.15 : status === 'thinking' ? 0.55 : 1;
      const target = Math.min(1, avg * 1.85 * boost);
      levelRef.current += (target - levelRef.current) * 0.22;
      el.style.setProperty('--level', levelRef.current.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      source?.disconnect();
      ctx?.close?.().catch(() => {});
    };
  }, [stream, status, muted]);

  const mode =
    muted || status === 'off'
      ? 'idle'
      : status === 'speaking'
        ? 'speaking'
        : status === 'thinking'
          ? 'thinking'
          : 'listening';

  return (
    <div className={`va-orb-stage va-orb--${mode}`} ref={rootRef} aria-hidden="true">
      <div className="va-orb-glow" />
      <div className="va-orb-floor" />
      <div className="va-orb-scene">
        <div className="va-orb-ring va-orb-ring--a" />
        <div className="va-orb-ring va-orb-ring--b" />
        <div className="va-orb-ring va-orb-ring--c" />
        <div className="va-orb-core">
          <div className="va-orb-core__shine" />
          <div className="va-orb-core__pulse" />
        </div>
      </div>
    </div>
  );
}
