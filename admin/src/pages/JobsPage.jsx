import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { JobCard } from '../components/jobs/JobCard.jsx';
import { JobSheet } from '../components/jobs/JobSheet.jsx';
import { useJobBoard } from '../hooks/useJobBoard.js';
import { completeJob, moveJobStage } from '../services/jobs.service.js';
import {
  COLUMNS,
  columnOf,
  errorWords,
  pickedUpToast,
  readyToast,
  stageView,
  startedToast,
} from '../utils/plain.js';

function matches(job, query) {
  if (!query) return true;
  const haystack = [job.job_number, job.title, job.customer?.name].filter(Boolean).join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export default function JobsPage() {
  const { stages, jobs, loading, error, version, refetch } = useJobBoard();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const view = useMemo(() => stageView(stages), [stages]);

  const grouped = useMemo(() => {
    const out = { new: [], working: [], ready: [], done: [] };
    const query = search.trim();
    for (const job of jobs) {
      if (!matches(job, query)) continue;
      out[columnOf(job, view)].push(job);
    }
    // Most urgent first; jobs without a date go last.
    const byDue = (a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
    out.new.sort(byDue);
    out.working.sort(byDue);
    out.ready.sort(byDue);
    return out;
  }, [jobs, view, search]);

  async function onAction(job, column) {
    setBusyId(job.id);
    try {
      if (column === 'new') {
        await moveJobStage(job.id, view.start.id);
        toast(startedToast(job));
      } else if (column === 'working') {
        await moveJobStage(job.id, view.ready.id);
        toast(readyToast(job));
      } else if (column === 'ready') {
        await completeJob(job.id);
        toast(pickedUpToast(job));
      }
      await refetch();
    } catch (err) {
      toast(errorWords(err, 'That did not work. Please try again.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Jobs</h1>
        <input
          className="search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search a name, job or customer"
          aria-label="Search jobs"
        />
      </div>

      {error ? <div className="banner-error">Could not load jobs: {error}</div> : null}

      {loading && !jobs.length ? (
        <div className="loading">Loading jobs…</div>
      ) : (
        <div className="cols">
          {COLUMNS.map((col) => (
            <section key={col.key} className={`col col-${col.key}`}>
              <div className="col-head">
                <i />
                <h2>{col.label}</h2>
                <span className="count">{grouped[col.key].length}</span>
              </div>
              <div className="cards">
                {grouped[col.key].length ? (
                  grouped[col.key].map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      column={col.key}
                      busy={busyId === job.id}
                      onOpen={(item) => setOpenId(item.id)}
                      onAction={onAction}
                    />
                  ))
                ) : (
                  <div className="col-empty">{search ? 'No match' : 'Nothing here'}</div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {openId ? <JobSheet jobId={openId} view={view} version={version} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
