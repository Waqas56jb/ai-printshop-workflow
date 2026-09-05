import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmQueue } from '../../components/today/ConfirmQueue.jsx';
import { JobList } from '../../components/today/JobList.jsx';
import { Kpis } from '../../components/today/Kpis.jsx';
import { QuickCreate } from '../../components/today/QuickCreate.jsx';
import { VoiceFeed } from '../../components/today/VoiceFeed.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useToday } from '../../hooks/useToday.js';
import { assignJob } from '../../services/jobs.service.js';
import { formatDueLabel } from '../../utils/date.js';

function helloDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function printDue(jobs) {
  const rows = (jobs || [])
    .map(
      (job) =>
        `<tr><td>${job.job_number}</td><td>${job.title || ''}</td><td>${job.customer_name || ''}</td><td>${job.stage?.name || ''}</td><td>${formatDueLabel(job.due_date)}</td></tr>`
    )
    .join('');
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Today's list</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}</style>
    </head><body><h1>Jobs due today</h1><table><thead><tr><th>Job</th><th>Title</th><th>Customer</th><th>Stage</th><th>Due</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export default function TodayPage() {
  const { profile } = useAuth();
  const { openJob } = useOutletContext();
  const { dashboard, pending, loading, error, refetch } = useToday();
  const [tab, setTab] = useState('mine');

  const lists = useMemo(() => {
    const mine = dashboard?.my_jobs || [];
    const due = dashboard?.due_today || [];
    const all = dashboard?.all_active || [];
    return { mine, due, all };
  }, [dashboard]);

  const jobs = tab === 'due' ? lists.due : tab === 'all' ? lists.all : lists.mine;
  const counts = dashboard?.counts || {};

  function handleError(message) {
    toast(message);
  }

  if (loading) {
    return <main className="content"><div className="empty">Loading today…</div></main>;
  }

  if (error) {
    return <main className="content"><div className="empty">{error}</div></main>;
  }

  return (
    <main className="content">
      <div className="hello">
        <div>
          <h1>{helloDate()}</h1>
          <p>
            <b>{counts.due_today || 0} jobs due today</b>
            {' · '}
            {counts.overdue || 0} overdue
            {' · '}
            {counts.assigned_to_me || lists.mine.length} assigned to you
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => printDue(lists.due)}>
          <Printer />
          Print today's list
        </button>
      </div>

      <ConfirmQueue
        items={pending}
        onDone={(_item, mode) => {
          toast(mode === 'rejected' ? 'Command rejected' : 'Command done');
          refetch();
        }}
        onError={handleError}
      />

      <div className="cols">
        <div className="stack">
          <JobList
            tab={tab}
            onTab={setTab}
            counts={{ mine: lists.mine.length, due: lists.due.length, all: lists.all.length }}
            jobs={jobs}
            onAssign={async (job) => {
              try {
                await assignJob(job.id, profile.id);
                toast('Assigned to you');
                refetch();
              } catch (err) {
                handleError(err.response?.data?.message || 'Could not assign');
              }
            }}
            onChanged={refetch}
            onError={handleError}
          />
        </div>
        <div className="stack">
          <Kpis counts={counts} />
          <QuickCreate
            onFullForm={() => openJob(null)}
            onParsed={(parsed) => openJob(parsed)}
            onError={handleError}
          />
          <VoiceFeed items={dashboard?.voice_today || []} />
        </div>
      </div>
    </main>
  );
}
