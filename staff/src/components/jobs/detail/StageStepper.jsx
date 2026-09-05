import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../../ui/Button.jsx';
import { formatDuration, formatShortDate, formatSinceTime } from '../../../utils/date.js';

export function StageStepper({ job, stages = [], onMove }) {
  const currentIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.id === job.stage_id)
  );
  const current = stages[currentIndex];
  const prev = stages[currentIndex - 1];
  const next = stages[currentIndex + 1];
  const history = job.history || [];
  const lastMove = [...history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const enteredAt = lastMove?.created_at || job.updated_at;
  const n = Math.max(stages.length, 2);
  const progress = `${(currentIndex / (n - 1)) * 86}%`;

  function timeFor(stage, index) {
    const hit = history
      .filter((row) => row.to_stage_id === stage.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    if (index === currentIndex) return formatSinceTime(hit?.created_at || enteredAt);
    if (!hit || index > currentIndex) return null;
    return formatShortDate(hit.created_at);
  }

  const mover = lastMove?.changed_by_profile?.full_name;
  const source = lastMove?.source === 'voice' ? 'voice' : 'manual';

  return (
    <section className="stepper">
      <div className="steps" style={{ '--progress': progress, '--n': stages.length || 7 }}>
        {stages.map((stage, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'now' : '';
          const label = timeFor(stage, index);
          return (
            <div key={stage.id} className={`step ${state}`.trim()}>
              {stage.name}
              {label ? <time>{label}</time> : null}
            </div>
          );
        })}
      </div>
      <div className="stepper-foot">
        <span className="t">
          In {current?.name || 'this stage'} for {formatDuration(enteredAt)}
          {mover ? ` · moved by ${mover} via ${source}` : ''}
        </span>
        {prev ? (
          <Button variant="ghost" className="btn-sm" onClick={() => onMove(prev.id)}>
            <ArrowLeft />
            Back to {prev.name}
          </Button>
        ) : null}
        {next ? (
          <Button className="btn-sm" onClick={() => onMove(next.id)}>
            {next.is_final ? 'Mark delivered' : `Move to ${next.name}`}
            <ArrowRight />
          </Button>
        ) : null}
      </div>
    </section>
  );
}
