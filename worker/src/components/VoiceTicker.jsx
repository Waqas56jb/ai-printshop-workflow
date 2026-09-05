import { formatClockTime, formatRelative } from '../utils/date.js';

export function VoiceTicker({ lastVoice, updatedAt }) {
  const who = lastVoice?.user_name ? lastVoice.user_name.split(/\s+/)[0] : null;

  return (
    <footer className="foot">
      {lastVoice ? (
        <div className="tick">
          <span className="mic">
            <svg viewBox="0 0 24 24">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </span>
          {lastVoice.transcript ? <q>{lastVoice.transcript}</q> : null}
          {lastVoice.summary ? <b>{lastVoice.summary}</b> : null}
          {who || lastVoice.created_at ? (
            <span>
              {who ? `· ${who}` : ''}
              {who && lastVoice.created_at ? ' · ' : who ? '' : '· '}
              {lastVoice.created_at ? formatRelative(lastVoice.created_at) : ''}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="r">
        <span>
          <i style={{ background: 'var(--amber)' }}></i>due today
        </span>
        <span>
          <i style={{ background: 'var(--red)' }}></i>overdue
        </span>
        <span>Updated {updatedAt ? formatClockTime(updatedAt) : '—'}</span>
      </div>
    </footer>
  );
}
