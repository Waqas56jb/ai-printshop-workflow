import { Link } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { quoteTranscript } from '../../utils/format.js';

function clock(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function didLine(item) {
  if (item.intent?.action === 'move_stage' && item.job_number) {
    return `${item.job_number} → ${item.intent.stage || 'next stage'}`;
  }
  if (item.intent?.action === 'create_job' && item.job_number) {
    return `Created ${item.job_number}`;
  }
  if (item.intent?.action === 'due_today') {
    return item.intent?.reply || 'Listed due jobs';
  }
  return item.intent?.reply || item.action || 'Done';
}

export function VoiceFeed({ items }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Voice today</h3>
        <Link to="/voice">All</Link>
      </div>
      {(items || []).length ? (
        items.map((item) => (
          <div className="cmd" key={item.id}>
            <div className="mic">
              <Mic />
            </div>
            <div>
              <div className="said">{quoteTranscript(item.transcript)}</div>
              <div className="did">{didLine(item)}</div>
              <div className="meta">
                {item.user_name || 'Voice'} · {clock(item.created_at)}
              </div>
            </div>
            <span className="st">{item.status === 'executed' ? 'Done' : item.status}</span>
          </div>
        ))
      ) : (
        <div className="empty">No voice commands yet today</div>
      )}
    </section>
  );
}
