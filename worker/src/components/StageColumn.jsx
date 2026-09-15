import { useEffect, useMemo, useRef } from 'react';
import { JobCard } from './JobCard.jsx';
import { sortBoardJobs } from '../utils/boardJobs.js';

export function StageColumn({ stage, settings, prevJobs, focusedJobId, keepVisible = false }) {
  const jobs = useMemo(() => sortBoardJobs(stage.jobs || []), [stage.jobs]);
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
    <section
      className={`col${jobs.length ? '' : ' empty'}${keepVisible ? ' keep-visible' : ''}`}
      style={{ '--stage': stage.color }}
    >
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
              focused={job.id === focusedJobId}
            />
          ))
        )}
      </div>
    </section>
  );
}
