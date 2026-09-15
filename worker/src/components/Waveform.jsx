const BARS = 8;

export function Waveform({ active = false }) {
  return (
    <div className={`waveform${active ? ' active' : ''}`} aria-hidden="true">
      {Array.from({ length: BARS }).map((_, index) => (
        <span key={index} style={{ '--i': index }} />
      ))}
    </div>
  );
}
