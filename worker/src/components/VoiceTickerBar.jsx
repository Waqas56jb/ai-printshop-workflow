import { useEffect, useRef, useState } from 'react';
import { formatClockTime, formatRelative } from '../utils/date.js';

const VISIBLE_MS = 6000;
const FADE_OUT_MS = 500;

export function VoiceTickerBar({ ticker, updatedAt }) {
  const [active, setActive] = useState(null);
  const [phase, setPhase] = useState('idle'); // 'in' | 'idle' | 'out'
  const hideTimer = useRef(null);
  const clearTimer = useRef(null);
  const lastKey = useRef(null);

  useEffect(() => {
    if (!ticker) return undefined;
    const key = ticker.created_at || `${ticker.transcript}-${ticker.ai_reply}`;
    if (key === lastKey.current) return undefined;
    lastKey.current = key;

    setActive(ticker);
    setPhase('in');
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    hideTimer.current = setTimeout(() => {
      setPhase('out');
      clearTimer.current = setTimeout(() => {
        setActive(null);
        setPhase('idle');
      }, FADE_OUT_MS);
    }, VISIBLE_MS);
    return () => {
      clearTimeout(hideTimer.current);
      clearTimeout(clearTimer.current);
    };
  }, [ticker]);

  const who = active?.user_name ? active.user_name.split(/\s+/)[0] : null;

  return (
    <footer className="foot">
      <div className={`tick-bar${phase !== 'idle' ? ` show ${phase}` : ''}`}>
        {active ? (
          <div className="tick">
            <span className="mic pulse">
              <svg viewBox="0 0 24 24">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            </span>
            <div className="tick-copy">
              {active.transcript ? <q>{active.transcript}</q> : null}
              {active.ai_reply ? <b>{active.ai_reply}</b> : null}
            </div>
            {who || active.created_at ? (
              <span className="tick-meta">
                {who || ''}
                {who && active.created_at ? ' · ' : ''}
                {active.created_at ? formatRelative(active.created_at) : ''}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="tick idle">
            <span className="mic">
              <svg viewBox="0 0 24 24">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            </span>
            <div className="tick-copy">
              <b>Listening for shop commands</b>
            </div>
          </div>
        )}
      </div>
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
