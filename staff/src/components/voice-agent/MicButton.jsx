export function MicButton({ status, onToggle, hidden }) {
  if (hidden) return null;
  const live = status !== 'off';
  const label = status === 'speaking' ? 'Speaking…' : live ? 'Listening…' : 'Talk';
  return (
    <button type="button" className={`mic-btn${live ? ' live' : ''}`} onClick={onToggle}>
      {live ? (
        <span className="pulse"></span>
      ) : (
        <svg viewBox="0 0 24 24">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
        </svg>
      )}
      {label}
    </button>
  );
}
