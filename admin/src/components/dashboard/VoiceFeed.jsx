import { Mic } from 'lucide-react';
import { Panel } from '../ui/Panel.jsx';
import { formatRelative } from '../../utils/date.js';
import { quoteTranscript } from '../../utils/format.js';

function statusClass(status) {
  if (status === 'pending_confirmation') return 'pending';
  if (status === 'failed' || status === 'rejected') return 'fail';
  return 'ok';
}

function statusLabel(status) {
  if (status === 'pending_confirmation') return 'Confirm';
  if (status === 'rejected') return 'Rejected';
  if (status === 'failed') return 'Failed';
  return 'Done';
}

export function VoiceFeed({ commands = [], onConfirm, onReject }) {
  return (
    <Panel title="Voice activity" actionTo="/voice" actionLabel="History">
      <div className="feed">
        {commands.length === 0 ? (
          <div className="empty">
            <p>No voice commands yet.</p>
          </div>
        ) : (
          commands.slice(0, 6).map((cmd) => (
            <div className="cmd" key={cmd.id}>
              <div className="mic">
                <Mic />
              </div>
              <div>
                <div className="said">{quoteTranscript(cmd.transcript)}</div>
                <div className="did">{cmd.intent?.reply || cmd.action || 'Command received'}</div>
                {cmd.status === 'pending_confirmation' ? (
                  <div className="actions">
                    <button type="button" className="yes" onClick={() => onConfirm?.(cmd.id)}>
                      Confirm
                    </button>
                    <button type="button" onClick={() => onReject?.(cmd.id)}>
                      Reject
                    </button>
                  </div>
                ) : null}
                <div className="meta">{formatRelative(cmd.created_at)}</div>
              </div>
              <span className={`st ${statusClass(cmd.status)}`}>{statusLabel(cmd.status)}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
