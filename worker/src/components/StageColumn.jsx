import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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

function isCompact() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches;
}

export function StageColumn({ stage, settings, prevJobs }) {
  const jobs = useMemo(() => sortJobs(stage.jobs || []), [stage.jobs]);
  const jobSig = jobs.map((job) => `${job.id}:${job.updated_at}`).join('|');
  const cardsRef = useRef(null);
  const [compact, setCompact] = useState(isCompact);
  const [visible, setVisible] = useState(jobs.length);

  useLayoutEffect(() => {
    function onMq() {
      setCompact(isCompact());
    }
    const mq = window.matchMedia('(max-width: 1100px)');
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, []);

  useLayoutEffect(() => {
    const el = cardsRef.current;
    if (!el) return undefined;

    function measure() {
      if (isCompact() || !jobs.length) {
        setVisible(jobs.length);
        return;
      }
      const first = el.querySelector('.card');
      if (!first) {
        setVisible(jobs.length);
        return;
      }
      const gap = parseFloat(getComputedStyle(el).gap) || 0;
      const cardH = first.getBoundingClientRect().height;
      const avail = el.clientHeight;
      if (!cardH || !avail) {
        setVisible(jobs.length);
        return;
      }
      const rawFit = Math.max(1, Math.floor((avail + gap) / (cardH + gap)));
      if (jobs.length <= rawFit) {
        setVisible(jobs.length);
        return;
      }
      const moreH = 28;
      setVisible(Math.max(1, Math.floor((avail - moreH + gap) / (cardH + gap))));
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [jobSig, jobs.length, compact, settings?.card_size]);

  const limit = compact ? jobs.length : visible;
  const shown = jobs.slice(0, limit);
  const hidden = compact ? 0 : Math.max(0, jobs.length - shown.length);

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
          shown.map((job) => (
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
        {hidden > 0 ? <div className="more">+{hidden} more</div> : null}
      </div>
    </section>
  );
}
