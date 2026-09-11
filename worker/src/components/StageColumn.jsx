import { useEffect, useMemo, useRef } from 'react';
import { JobCard } from './JobCard.jsx';

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

function sortJobs(jobs) {
  return [...jobs].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    if (a.is_due_today !== b.is_due_today) return a.is_due_today ? -1 : 1;
    const ad = a.due_date || '9999-12-31';
    const bd = b.due_date || '9999-12-31';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4);
  });
}

export function StageColumn({ stage, settings, prevJobs }) {
  const jobs = useMemo(() => sortJobs(stage.jobs || []), [stage.jobs]);
  const cardsRef = useRef(null);

  useEffect(() => {
    const el = cardsRef.current;
    if (!el || !jobs.length) return undefined;

    let frame;
    let dir = 1;
    let pauseUntil = 0;

    function step(now) {
      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow > 8 && now >= pauseUntil) {
        el.scrollTop += dir * 0.35;
        if (el.scrollTop >= overflow - 1) {
          dir = -1;
          pauseUntil = now + 1600;
        } else if (el.scrollTop <= 0) {
          dir = 1;
          pauseUntil = now + 1600;
        }
      }
      frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [jobs]);

  return (
    <section className={`col${jobs.length ? '' : ' empty'}`} style={{ '--stage': stage.color }}>
      <div className="col-head">
        <h2>{stage.name}</h2>
        <span className={`n num${jobs.length ? '' : ' zero'}`}>{jobs.length}</span>
      </div>
      <div className="cards" ref={cardsRef}>
        {jobs.length === 0 ? (
          <div className="empty-col">Clear</div>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              stageId={stage.id}
              stageName={stage.name}
              settings={settings}
              prevJobs={prevJobs}
            />
          ))
        )}
      </div>
    </section>
  );
}
