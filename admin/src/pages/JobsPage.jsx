import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '../components/Icon.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { JobCard } from '../components/jobs/JobCard.jsx';
import { NewJobModal } from '../components/jobs/NewJobModal.jsx';
import { JobSheet } from '../components/jobs/JobSheet.jsx';
import { StagesEditor } from '../components/jobs/StagesEditor.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useJobBoard } from '../hooks/useJobBoard.js';
import { completeJob, moveJobStage } from '../services/jobs.service.js';
import { DONE, columnKey, doneToast, errorWords, isLastStage, movedToast, nextStage } from '../utils/plain.js';

function matches(job, query) {
  if (!query) return true;
  const haystack = [job.job_number, job.title, job.customer?.name].filter(Boolean).join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export default function JobsPage() {
  const { profile } = useAuth();
  const { stages, jobs, loading, error, version, refetch } = useJobBoard();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const scroller = useRef(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const columns = useMemo(() => {
    const byKey = new Map(stages.map((stage) => [stage.id, []]));
    byKey.set(DONE, []);
    const query = search.trim();
    for (const job of jobs) {
      if (!matches(job, query)) continue;
      byKey.get(columnKey(job))?.push(job);
    }
    // Most urgent first; jobs without a date go last. Done keeps newest first.
    const byDue = (a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
    stages.forEach((stage) => byKey.get(stage.id).sort(byDue));
    return [
      ...stages.map((stage) => ({ key: stage.id, label: stage.name, color: stage.color, stage, jobs: byKey.get(stage.id) })),
      { key: DONE, label: 'Done', color: '#161a1f', stage: null, jobs: byKey.get(DONE) },
    ];
  }, [jobs, stages, search]);

  const updateArrows = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanScroll({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener('resize', updateArrows);
    return () => window.removeEventListener('resize', updateArrows);
  }, [updateArrows, columns.length, loading]);

  function scrollBy(direction) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * Math.max(320, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  function actionFor(job) {
    if (job.status === 'completed') return null;
    if (isLastStage(stages, job.stage_id)) return { label: 'Done ✓', done: true };
    const next = nextStage(stages, job.stage_id);
    return next ? { label: `→ ${next.name}`, next } : null;
  }

  async function onAction(job) {
    const action = actionFor(job);
    if (!action) return;
    setBusyId(job.id);
    try {
      if (action.done) {
        await completeJob(job.id);
        toast(doneToast(job));
      } else {
        const moved = await moveJobStage(job.id, action.next.id);
        toast(movedToast(job, action.next, moved?.status === 'completed'));
      }
      await refetch();
    } catch (err) {
      toast(errorWords(err, 'That did not work. Please try again.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Jobs">
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a job or customer"
            aria-label="Find a job or customer"
          />
        </label>
        <div className="spacer" />
        {profile?.role === 'admin' ? (
          <button type="button" className="pill-btn" onClick={() => setEditing(true)}>
            <Icon name="edit" />
            Edit stages
          </button>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + New job
        </button>
      </PageHeader>

      <main className="content">
        {error ? <div className="banner-error">Could not load jobs: {error}</div> : null}

        {loading && !jobs.length ? (
          <div className="loading">Loading jobs…</div>
        ) : (
          <div className="cols-wrap">
            {canScroll.left ? (
              <button type="button" className="scroll-arrow left" onClick={() => scrollBy(-1)} aria-label="Scroll left">
                ‹
              </button>
            ) : null}
            <div className="cols" ref={scroller} onScroll={updateArrows}>
              {columns.map((col) => (
                <section key={col.key} className={`col${col.key === DONE ? ' col-done' : ''}`} style={{ '--stage': col.color }}>
                  <div className="col-head">
                    <h2>{col.label}</h2>
                    <span className="count num">{col.jobs.length}</span>
                  </div>
                  <div className="cards">
                    {col.jobs.length ? (
                      col.jobs.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          action={actionFor(job)}
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
            {canScroll.right ? (
              <button type="button" className="scroll-arrow right" onClick={() => scrollBy(1)} aria-label="Scroll right">
                ›
              </button>
            ) : null}
          </div>
        )}

        {openId ? (
          <JobSheet jobId={openId} stages={stages} version={version} onClose={() => setOpenId(null)} />
        ) : null}
        {editing ? <StagesEditor stages={stages} jobs={jobs} onChanged={refetch} onClose={() => setEditing(false)} /> : null}
        {creating ? <NewJobModal onClose={() => setCreating(false)} /> : null}
      </main>
    </>
  );
}
