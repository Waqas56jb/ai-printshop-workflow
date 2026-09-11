import { VoiceOrb } from './VoiceOrb.jsx';
import { ToolCallCard } from './ToolCallCard.jsx';

function clock(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function VoiceAgentPanel({
  open,
  status,
  muted,
  error,
  messages,
  stream,
  callerName,
  tips,
  onClose,
  onMute,
  onEnd,
  onTip,
  onPickJob,
}) {
  if (!open) return null;

  const empty = messages.length === 0;
  const label =
    status === 'speaking'
      ? 'Speaking'
      : status === 'thinking'
        ? 'Thinking'
        : status === 'off'
          ? 'Off'
          : 'Listening';

  return (
    <div className="va-panel" role="dialog" aria-label="Voice assistant">
      <div className="va-panel__aura" aria-hidden="true" />
      <header className="va-panel__head">
        <div className="va-panel__identity">
          <div className={`va-panel__pill va-panel__pill--${status === 'off' ? 'off' : status === 'thinking' ? 'thinking' : 'live'}`}>
            <span className="va-panel__dot" />
            {label}
          </div>
          <p className="va-panel__sub">
            Live speech · multilingual
            {callerName ? ` · ${callerName}` : ''}
          </p>
        </div>
        <button type="button" className="va-panel__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <VoiceOrb stream={stream} status={status} muted={muted} />

      {error ? <div className="va-panel__err">{error}</div> : null}

      {empty && !error ? (
        <div className="va-panel__tips">
          <p>Try saying</p>
          {tips.map((tip) => (
            <button key={tip} type="button" onClick={() => onTip(tip)}>
              “{tip}”
            </button>
          ))}
        </div>
      ) : (
        <div className="va-panel__log">
          {messages.map((row) =>
            row.role === 'tool' ? (
              <ToolCallCard
                key={row.id}
                tool={row.tool}
                onPick={onPickJob}
                onCancel={() => onTip?.('cancel')}
              />
            ) : (
              <div key={row.id} className={`va-msg va-msg--${row.role === 'user' ? 'user' : 'ai'}`}>
                <div className={`va-msg__bubble${row.partial ? ' is-partial' : ''}`}>{row.text}</div>
                {row.at ? <div className="va-msg__time">{clock(row.at)}</div> : null}
              </div>
            )
          )}
        </div>
      )}

      <footer className="va-panel__foot">
        <p className="va-panel__hint">
          Say <b>stop</b> to end · Chrome recommended
        </p>
        <button type="button" className={`va-panel__mute${muted ? ' is-on' : ''}`} onClick={onMute}>
          {muted ? 'Muted' : 'Mute'}
        </button>
        <button type="button" className="va-panel__end" onClick={onEnd}>
          End
        </button>
      </footer>
    </div>
  );
}
