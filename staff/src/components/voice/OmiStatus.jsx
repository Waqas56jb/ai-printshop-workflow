import { Mic } from 'lucide-react';
import { formatRelative } from '../../utils/date.js';

export function OmiStatus({ status, compact }) {
  const receiving = Boolean(status?.receiving);
  const last = status?.last_command_at;
  const who = status?.last_device_name;

  return (
    <section className={`panel ${compact ? 'omi-compact' : ''}`.trim()}>
      <div className={`status ${receiving ? '' : 'off'}`.trim()}>
        <div className="big">
          <Mic />
        </div>
        <div>
          <h4>{receiving ? 'Receiving voice commands' : 'No commands recently'}</h4>
          <p>
            {last
              ? `Last command ${formatRelative(last)}${who ? ` from ${who}'s device` : ''}`
              : 'Waiting for the first OMI transcript'}
          </p>
        </div>
      </div>
      {compact ? null : (
        <dl className="kv">
          <div>
            <dt>Devices</dt>
            <dd className="num">{status?.devices?.length ?? 0}</dd>
          </div>
          <div>
            <dt>Today</dt>
            <dd className="num">{status?.today_count ?? 0}</dd>
          </div>
          <div>
            <dt>Understood</dt>
            <dd className="num">{status?.understood_percent ?? 0}%</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
