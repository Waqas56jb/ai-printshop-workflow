import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getOmiDebug } from '../../services/dashboard.service.js';
import { formatDayTime } from '../../utils/date.js';

export function OmiDebugFeed({ refreshKey }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    getOmiDebug()
      .then((rows) => {
        if (alive) setEvents(rows || []);
      })
      .catch(() => {
        if (alive) setEvents([]);
      });
    return () => {
      alive = false;
    };
  }, [open, refreshKey]);

  return (
    <section className="panel">
      <button type="button" className="panel-head debug-toggle" onClick={() => setOpen((value) => !value)}>
        <h3>OMI debug feed</h3>
        <span>{open ? <ChevronDown /> : <ChevronRight />}</span>
      </button>
      {open ? (
        <div className="debug-list">
          {events.length === 0 ? (
            <div className="setting">
              <div className="t">
                <b>No webhook events yet</b>
                <span>Incoming OMI transcripts appear here after a device speaks</span>
              </div>
            </div>
          ) : (
            events.map((row, index) => (
              <div className="debug-row" key={`${row.at}-${index}`}>
                <span className="num">{formatDayTime(row.at)}</span>
                <span>{row.uid || '—'}</span>
                <span>{row.text}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
