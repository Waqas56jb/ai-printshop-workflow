import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreVertical, Pencil, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/Button.jsx';
import { Chip } from '../../ui/Chip.jsx';
import { completeJob } from '../../../services/jobs.service.js';
import { dueTone, formatDueDetail } from '../../../utils/date.js';

function printTicket(job) {
  const approved = (job.artworks || []).find((item) => item.is_approved);
  const html = `<!doctype html><html><head><title>${job.job_number}</title>
    <style>body{font-family:sans-serif;padding:32px;color:#161A1F}h1{margin:0 0 8px}p{margin:4px 0}img{max-width:280px;margin-top:16px}</style>
    </head><body>
    <h1>${job.job_number}</h1>
    <p><b>${job.title || ''}</b></p>
    <p>Customer: ${job.customer?.name || '—'}</p>
    <p>Qty: ${job.quantity ?? '—'}</p>
    <p>Sizes: ${job.size_details || '—'}</p>
    <p>Due: ${job.due_date || '—'}</p>
    ${approved ? `<p>Artwork</p><img src="${approved.file_url}" alt="">` : ''}
    <script>window.onload=()=>window.print()</script>
    </body></html>`;
  const popup = window.open('', '_blank', 'width=720,height=900');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

export function JobHeader({ job, onEdit, onChanged }) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const priority = job.priority;
  const showPriority = priority === 'urgent' || priority === 'high';
  const due = dueTone(job.due_date);

  useEffect(() => {
    if (!menu) return undefined;
    function onDoc(event) {
      if (!menuRef.current?.contains(event.target)) setMenu(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);

  async function handleComplete() {
    try {
      await completeJob(job.id);
      toast('Job marked completed');
      setMenu(false);
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not complete job');
    }
  }

  return (
    <>
      <div className="crumb">
        <Link to="/jobs">Jobs</Link>
        <span>›</span>
        <span>{job.job_number}</span>
      </div>
      <div className="head">
        <div>
          <h1>
            {job.job_number}
            <Chip stage={job.stage?.name}>{job.stage?.name}</Chip>
            {showPriority ? (
              <span className={`prio-pill ${priority}`}>
                {priority[0].toUpperCase() + priority.slice(1)} priority
              </span>
            ) : null}
          </h1>
          <div className="meta">
            <span>{job.title}</span>
            <span>
              Customer <b>{job.customer?.name || '—'}</b>
            </span>
            <span>
              Due{' '}
              <b className={`due ${due}`}>{formatDueDetail(job.due_date)}</b>
            </span>
            <span>
              Assigned <b>{job.assignee?.full_name || 'Unassigned'}</b>
            </span>
          </div>
        </div>
        <div className="actions" ref={menuRef}>
          <Button variant="ghost" onClick={() => printTicket(job)}>
            <Printer />
            Print ticket
          </Button>
          <Button variant="ghost" onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
          <button type="button" className="icon-btn" title="More" onClick={() => setMenu((open) => !open)}>
            <MoreVertical />
          </button>
          {menu ? (
            <div className="more-menu">
              <button type="button" onClick={handleComplete}>
                Mark completed
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
