import { Waveform } from './Waveform.jsx';
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
  const label = status === 'speaking' ? 'Speaking' : status === 'thinking' ? 'Thinking' : status === 'off' ? 'Off' : 'Listening';

  return (
    <div className="va-panel">
      <div className="ph">
        <div>
          <div className={`st${status === 'thinking' ? ' thinking' : status === 'off' ? ' off' : ''}`}>
            <i></i>
            {label}
          </div>
          <div className="sub">Voice assistant{callerName ? ` · signed in as ${callerName}` : ''}</div>
        </div>
        <button type="button" className="x" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <Waveform stream={stream} speaking={status === 'speaking'} />
      {error ? <div className="err show">{error}</div> : null}
      {empty && !error ? (
        <div className="tips">
          <p>Try saying</p>
          {tips.map((tip) => (
            <button key={tip} type="button" onClick={() => onTip(tip)}>
              “{tip}”
            </button>
          ))}
        </div>
      ) : (
        <div className="log">
          {messages.map((row) =>
            row.role === 'tool' ? (
              <ToolCallCard
                key={row.id}
                tool={row.tool}
                onPick={onPickJob}
                onCancel={() => onTip?.('cancel')}
              />
            ) : (
              <div key={row.id} className={`m ${row.role === 'user' ? 'user' : 'ai'}`}>
                <div className={`b${row.partial ? ' partial' : ''}`}>{row.text}</div>
                {row.at ? <div className="t">{clock(row.at)}</div> : null}
              </div>
            )
          )}
        </div>
      )}
      <div className="pf">
        <div className="hint">
          Say <b>"stop"</b> to end · works best on Chrome
        </div>
        <button type="button" className={`mute${muted ? ' on' : ''}`} onClick={onMute}>
          {muted ? 'Muted' : 'Mute'}
        </button>
        <button type="button" className="end" onClick={onEnd}>
          End
        </button>
      </div>
    </div>
  );
}
