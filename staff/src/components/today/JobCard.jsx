import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, MoreVertical } from 'lucide-react';
import { Chip } from '../ui/Chip.jsx';
import { completeJob, createNote, moveJobStage, uploadArtwork } from '../../services/jobs.service.js';
import { dueTone, formatDueLabel } from '../../utils/date.js';

export function JobCard({ job, onAssign, onChanged, onError }) {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const next = job.next_stage;
  const finalMove = Boolean(next?.is_final || (!next && job.stage?.is_final));
  const blocked = Boolean(job.artwork_blocked && next);

  useEffect(() => {
    function onDoc() {
      setMenu(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  async function handleNext() {
    if (busy || blocked) return;
    setBusy(true);
    try {
      if (!next || finalMove) {
        await completeJob(job.id);
      } else {
        await moveJobStage(job.id, next.id);
      }
      onChanged();
    } catch (error) {
      onError(error.response?.data?.message || 'Could not move job');
    } finally {
      setBusy(false);
    }
  }

  const nextLabel = !next || finalMove ? 'Mark delivered' : `Move to ${next.name}`;
  const filesLine =
    job.artworks_count > 0
      ? `${job.artworks_count} file${job.artworks_count === 1 ? '' : 's'} · ${job.approved_artwork ? 'approved' : 'not approved'}`
      : job.stage?.slug === 'approved' || job.stage?.name === 'Approved'
        ? 'No artwork yet'
        : job.stage?.slug === 'ready' || job.stage?.name === 'Ready'
          ? 'Waiting for pickup'
          : job.time_in_stage
            ? `In ${String(job.stage?.name || '').toLowerCase()} ${job.time_in_stage}`
            : null;

  return (
    <div className="job" style={{ '--stage': job.stage?.color || '#8A93A1' }}>
      <span className="bar"></span>
      <div>
        <div className="l1">
          <span className="jn">{job.job_number}</span>
          <span className="jt">{job.title}</span>
          <Chip stage={job.stage?.name}>{job.stage?.name}</Chip>
          {job.priority === 'urgent' || job.priority === 'high' ? (
            <span className={`tag ${job.priority}`}>{job.priority === 'urgent' ? 'Urgent' : 'High'}</span>
          ) : null}
        </div>
        <div className="l2">
          <span>{job.customer_name}</span>
          <span className={`due ${dueTone(job.due_date)}`}>
            {formatDueLabel(job.due_date) === 'Today'
              ? 'Due today'
              : formatDueLabel(job.due_date) === 'Yesterday'
                ? 'Due yesterday'
                : formatDueLabel(job.due_date)}
          </span>
          {filesLine ? (
            <span style={job.artworks_count === 0 && filesLine === 'No artwork yet' ? { color: 'var(--ink-3)' } : undefined}>
              {filesLine}
            </span>
          ) : null}
        </div>
        {noteOpen ? (
          <form
            className="note-inline"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!note.trim()) return;
              try {
                await createNote(job.id, note.trim());
                setNote('');
                setNoteOpen(false);
                onChanged();
              } catch (error) {
                onError(error.response?.data?.message || 'Could not add note');
              }
            }}
          >
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" />
            <button type="submit" className="btn btn-ghost btn-sm">
              Save
            </button>
          </form>
        ) : null}
      </div>
      <div className="ops">
        <button
          type="button"
          className={`next ${blocked ? 'blocked' : ''}`.trim()}
          title={blocked ? 'Approve artwork first' : nextLabel}
          disabled={blocked || busy}
          onClick={handleNext}
        >
          {nextLabel}
          {finalMove || !next ? <Check /> : <ArrowRight />}
        </button>
        <div className="more-wrap">
          <button
            type="button"
            className="icon-btn"
            aria-label="More"
            onClick={(event) => {
              event.stopPropagation();
              setMenu((open) => !open);
            }}
          >
            <MoreVertical />
          </button>
          {menu ? (
            <div className="more-menu" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => navigate(`/jobs/${job.id}`)}>
                Open
              </button>
              <button
                type="button"
                onClick={() => {
                  setNoteOpen(true);
                  setMenu(false);
                }}
              >
                Add note
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}>
                Upload artwork
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onAssign(job);
                }}
              >
                Assign to me
              </button>
            </div>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.ai"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
              await uploadArtwork(job.id, file);
              onChanged();
            } catch (error) {
              onError(error.response?.data?.message || 'Could not upload');
            }
          }}
        />
      </div>
    </div>
  );
}
