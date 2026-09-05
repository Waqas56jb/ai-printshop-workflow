import { useEffect, useRef, useState } from 'react';

const BARS = 12;

export function Waveform({ stream, speaking }) {
  const [levels, setLevels] = useState(() => Array.from({ length: BARS }, () => 10));
  const raf = useRef(0);

  useEffect(() => {
    if (!stream) return undefined;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(data);
      const next = Array.from({ length: BARS }, (_, index) => {
        const sample = data[Math.floor((index / BARS) * data.length)] || 0;
        return 8 + Math.round((sample / 255) * 36);
      });
      setLevels(next);
      raf.current = requestAnimationFrame(tick);
    }
    tick();
    return () => {
      cancelAnimationFrame(raf.current);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [stream]);

  return (
    <div className={`wave${speaking ? ' assistant' : ''}`}>
      {levels.map((height, index) => (
        <i key={index} style={{ '--h': `${height}px` }}></i>
      ))}
    </div>
  );
}
