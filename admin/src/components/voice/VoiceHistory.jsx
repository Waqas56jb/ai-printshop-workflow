import { useMemo, useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { confirmVoice, listJobs } from '../../services/dashboard.service.js';
import { formatDayTime } from '../../utils/date.js';
import { firstName } from '../../utils/format.js';
import { toast } from 'sonner';

function statusMeta(status) {
  if (status === 'executed') return { cls: 'ok', label: 'Done' };
  if (status === 'pending_confirmation') return { cls: 'pending', label: 'Confirm' };
  if (status === 'rejected') return { cls: 'rej', label: 'Ignored' };
  return { cls: 'fail', label: 'Failed' };
}

export function VoiceHistory({ items = [], users = [], status, user, onStatus, onUser, onChanged }) {
  const [resolve, setResolve] = useState(null);
  const [candidates, setCandidates] = useState([]);

  const staff = useMemo(() => users.filter((item) => item.is_active !== false), [users]);

  async function openResolve(command) {
    const ref = command.intent?.job_ref || '';
    const result = await listJobs({ status: 'active', search: ref || undefined, page: 1, limit: 20 });
    setCandidates(result.items || []);
    setResolve(command);
  }

  async function pick(jobId) {
    try {
      await confirmVoice(resolve.id, jobId);
      toast('Command resolved');
      setResolve(null);
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not confirm');
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Command history</h3>
        <div className="filters">
          <label className="field">
            <select value={status} onChange={(event) => onStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="executed">Done</option>
              <option value="pending_confirmation">Needs confirmation</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="field">
            <select value={user} onChange={(event) => onUser(event.target.value)}>
              <option value="">Everyone</option>
              {staff.map((item) => (
                <option key={item.id} value={item.id}>
                  {firstName(item.full_name)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Said</th>
            <th>Understood</th>
            <th>Job</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const meta = statusMeta(row.status);
            const understood = row.intent?.stage
              ? `${row.action || row.intent.action} → ${row.intent.stage}`
              : row.action || row.intent?.action || '—';
            return (
              <tr key={row.id}>
                <td className="num">{formatDayTime(row.created_at).replace('Today, ', '')}</td>
                <td>{row.user_name || row.user?.full_name || '—'}</td>
                <td>
                  <q>{row.transcript}</q>
                </td>
                <td>{understood}</td>
                <td>{row.job_number || '—'}</td>
                <td>
                  <span className={`st ${meta.cls}`}>{meta.label}</span>
                </td>
                <td>
                  {row.status === 'pending_confirmation' ? (
                    <Button variant="ghost" className="btn-sm" onClick={() => openResolve(row)}>
                      Resolve
                    </Button>
                  ) : row.error ? (
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{row.error}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {resolve ? (
        <div className="resolve">
          <div className="scrim" onClick={() => setResolve(null)}></div>
          <div className="box">
            <h3>Which job did they mean?</h3>
            {candidates.length === 0 ? <p>No matching active jobs.</p> : null}
            {candidates.map((job) => (
              <button key={job.id} type="button" className="pick" onClick={() => pick(job.id)}>
                {job.job_number} · {job.title} · {job.customer?.name || ''}
              </button>
            ))}
            <Button variant="ghost" onClick={() => setResolve(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
