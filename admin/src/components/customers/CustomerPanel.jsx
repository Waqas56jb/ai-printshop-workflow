import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreVertical, Pencil, Plus, User } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Chip } from '../ui/Chip.jsx';
import { deleteCustomer, updateCustomer } from '../../services/jobs.service.js';
import { formatLastActivity, formatSinceDate } from '../../utils/date.js';
import { formatSpent } from '../../utils/format.js';

function messageHref(customer) {
  if (customer.phone) {
    const digits = customer.phone.replace(/\D/g, '');
    const intl = digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
    return `https://wa.me/${intl}`;
  }
  if (customer.email) return `mailto:${customer.email}`;
  return null;
}

export function CustomerPanel({ customer, loading, onEdit, onNewJob, onDeleted, onChanged }) {
  const [notes, setNotes] = useState('');
  const [hint, setHint] = useState('Saved automatically');
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setNotes(customer?.notes || '');
    setHint('Saved automatically');
  }, [customer?.id]);

  const customerId = customer?.id;
  const savedNotes = customer?.notes || '';

  useEffect(() => {
    if (!customerId || notes === savedNotes) return undefined;
    setHint('Saving…');
    const timer = setTimeout(async () => {
      try {
        await updateCustomer(customerId, { notes });
        setHint('Saved');
        onChanged?.();
      } catch (error) {
        setHint('Could not save');
        toast(error.response?.data?.message || 'Could not save notes');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [notes, customerId, savedNotes, onChanged]);

  useEffect(() => {
    if (!menu) return undefined;
    function onDoc(event) {
      if (!menuRef.current?.contains(event.target)) setMenu(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);

  if (!customer) {
    return (
      <aside className="side">
        <div className="panel empty-side">
          <User />
          <div>Select a customer to see their jobs and notes</div>
        </div>
      </aside>
    );
  }

  const jobs = customer.jobs || [];
  const active = jobs.filter((job) => job.status === 'active');
  const past = jobs.filter((job) => job.status !== 'active');
  const href = messageHref(customer);

  async function handleDelete() {
    setMenu(false);
    if (jobs.length) {
      const activeCount = active.length;
      toast(
        activeCount
          ? `Cannot delete — this customer has ${activeCount} active job${activeCount === 1 ? '' : 's'}`
          : 'Cannot delete — this customer still has jobs'
      );
      return;
    }
    if (!window.confirm(`Delete ${customer.name}?`)) return;
    try {
      await deleteCustomer(customer.id);
      toast('Customer deleted');
      onDeleted();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not delete customer');
    }
  }

  return (
    <aside className="side">
      <div className="panel">
        <div className="card-head">
          <Avatar name={customer.name} />
          <div>
            <h2>{customer.name}</h2>
            <div className="c">{[customer.phone, customer.email].filter(Boolean).join(' · ') || '—'}</div>
            <div className="c">Customer since {formatSinceDate(customer.created_at)}</div>
          </div>
          <div className="ops" ref={menuRef}>
            <button type="button" className="icon-btn" title="Edit" onClick={onEdit}>
              <Pencil />
            </button>
            <button type="button" className="icon-btn" title="More" onClick={() => setMenu((open) => !open)}>
              <MoreVertical />
            </button>
            {menu ? (
              <div className="more-menu">
                <button type="button" className="btn-danger" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <dl className="kv">
          <div>
            <dt>Jobs</dt>
            <dd className="num">{customer.stats?.total_jobs ?? jobs.length}</dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd className="num">{customer.stats?.active_jobs ?? active.length}</dd>
          </div>
          <div>
            <dt>Spent</dt>
            <dd className="num">{formatSpent(customer.stats?.total_spent)}</dd>
          </div>
        </dl>
        {active.length ? (
          <>
            <div className="sec-h">Active jobs</div>
            {active.map((job) => (
              <Link className="jrow" key={job.id} to={`/jobs/${job.id}`}>
                <span className="jn">{job.job_number}</span>
                <span className="jt">{job.title}</span>
                <Chip stage={job.stage?.name}>{job.stage?.name}</Chip>
                <span className="jd">{formatLastActivity(job.due_date || job.created_at)}</span>
              </Link>
            ))}
          </>
        ) : (
          <div className="sec-h">Active jobs</div>
        )}
        <div className="sec-h">
          Past jobs
          {past.length ? <Link to={`/jobs?customer=${customer.id}`}>All {past.length}</Link> : null}
        </div>
        {past.slice(0, 3).map((job) => (
          <Link className="jrow" key={job.id} to={`/jobs/${job.id}`}>
            <span className="jn">{job.job_number}</span>
            <span className="jt">{job.title}</span>
            <Chip stage={job.stage?.name}>{job.stage?.name}</Chip>
            <span className="jd">{formatLastActivity(job.created_at)}</span>
          </Link>
        ))}
        <div className="sec-h" style={{ marginTop: 6 }}>
          Notes
        </div>
        <div className="notes">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={loading}
            placeholder="Add a note…"
          />
          <div className="hint">{hint}</div>
        </div>
        <div className="side-foot">
          {href ? (
            <a className="btn btn-ghost" href={href} target="_blank" rel="noreferrer">
              Message
            </a>
          ) : (
            <Button variant="ghost" disabled>
              Message
            </Button>
          )}
          <Button onClick={onNewJob}>
            <Plus />
            New job
          </Button>
        </div>
      </div>
    </aside>
  );
}
