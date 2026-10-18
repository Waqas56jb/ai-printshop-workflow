import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { addJobFile, deleteJob, getJob, updateJob } from '../../services/jobs.service.js';
import { announceJobsChanged } from '../../hooks/useJobBoard.js';
import {
  COLUMNS,
  columnOf,
  dueLine,
  errorWords,
  fileExt,
  historyLines,
  isImageFile,
  jobPhrase,
  whenWords,
} from '../../utils/plain.js';
import { Modal } from '../Modal.jsx';

function longDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function DeleteDialog({ job, onCancel, onDeleted }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toUpperCase() === 'DELETE';

  async function remove() {
    setBusy(true);
    try {
      await deleteJob(job.id);
      toast(`${jobPhrase(job)} was deleted`);
      announceJobsChanged();
      onDeleted();
    } catch (err) {
      toast(errorWords(err, 'Could not delete the job.'));
      setBusy(false);
    }
  }

  return (
    <Modal title="Delete this job?" onClose={onCancel}>
      <p style={{ fontSize: 18, marginBottom: 14 }}>
        {job.job_number} — {job.title} will be gone for good, with its files and history.
      </p>
      <label className="field">
        <span>Type DELETE to confirm</span>
        <input className="input" value={typed} onChange={(event) => setTyped(event.target.value)} autoFocus autoComplete="off" />
      </label>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Keep it
        </button>
        <button type="button" className="btn btn-danger-solid" onClick={remove} disabled={!ok || busy}>
          {busy ? 'Deleting…' : 'Delete job'}
        </button>
      </div>
    </Modal>
  );
}

export function JobSheet({ jobId, view, version, onClose }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [editingDue, setEditingDue] = useState(false);
  const [dueValue, setDueValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    try {
      setJob(await getJob(jobId));
      setError('');
    } catch (err) {
      setError(err.response?.status === 404 ? 'This job is no longer here.' : errorWords(err));
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load, version]);

  async function saveDue() {
    setSaving(true);
    try {
      await updateJob(job.id, { due_date: dueValue || null });
      toast(dueValue ? `Due date changed to ${longDate(dueValue)}` : 'Due date removed');
      setEditingDue(false);
      announceJobsChanged();
      await load();
    } catch (err) {
      toast(errorWords(err, 'Could not change the date.'));
    } finally {
      setSaving(false);
    }
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await addJobFile(job.id, file);
      toast(`File added to ${jobPhrase(job)}`);
      announceJobsChanged();
      await load();
    } catch (err) {
      toast(errorWords(err, 'The file did not upload.'));
    } finally {
      setUploading(false);
    }
  }

  function openFile(file) {
    if (isImageFile(file)) setViewing(file);
    else window.open(file.file_url, '_blank', 'noopener');
  }

  if (!job) {
    return (
      <Modal title={error ? 'Job' : 'Loading…'} onClose={onClose}>
        {error ? <p className="banner-error">{error}</p> : <p className="loading">Loading…</p>}
      </Modal>
    );
  }

  const column = columnOf(job, view);
  const columnLabel = COLUMNS.find((item) => item.key === column)?.label;
  const due = dueLine(job, column);
  const files = [...(job.artworks || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const history = historyLines(job, view);
  const flag = due.tone === 'late' || due.tone === 'today';

  return (
    <>
      <Modal
        wide
        onClose={onClose}
        title={
          <>
            <span className={`stage-badge ${column}`}>{columnLabel}</span>
            <div>{job.title}</div>
            <div className="hint" style={{ fontSize: 17, fontWeight: 600 }}>
              {job.job_number}
              {job.quantity > 1 ? ` · ${job.quantity} pieces` : ''}
            </div>
          </>
        }
      >
        <div className="sheet-facts">
          <div>
            <b>Customer</b> {job.customer?.name || '—'}
          </div>
          <div>
            <b>Phone</b>{' '}
            {job.customer?.phone ? <a href={`tel:${job.customer.phone}`}>{job.customer.phone}</a> : 'No phone saved'}
          </div>
          <div>
            <b>Due</b> {longDate(job.due_date)}
            {flag ? <span className={`card-due ${due.tone}`} style={{ display: 'inline' }}>{` (${due.text})`}</span> : null}
          </div>
        </div>
        {editingDue ? (
          <div className="due-edit">
            <input className="input" type="date" value={dueValue} onChange={(event) => setDueValue(event.target.value)} autoFocus />
            <button type="button" className="btn btn-primary" onClick={saveDue} disabled={saving}>
              {saving ? 'Saving…' : 'Save date'}
            </button>
            <button type="button" className="btn" onClick={() => setEditingDue(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        ) : null}

        <div className="sheet-section">
          <h3>Files</h3>
          {files.length ? (
            <div className="thumbs">
              {files.map((file) => (
                <button key={file.id} type="button" className="thumb" onClick={() => openFile(file)} title={file.file_name}>
                  {isImageFile(file) ? (
                    <img src={file.file_url} alt={file.file_name} loading="lazy" />
                  ) : (
                    <>
                      <span className="ext">{fileExt(file)}</span>
                      <span className="name">{file.file_name}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">No files yet.</p>
          )}
        </div>

        <div className="sheet-section">
          <h3>What happened</h3>
          {history.length ? (
            <ul className="history">
              {history.map((line, index) => (
                <li key={`${line.at}-${index}`}>
                  <span>{whenWords(line.at)}</span>
                  <div>{line.text}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Nothing yet.</p>
          )}
        </div>

        <div className="sheet-buttons">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDueValue(job.due_date ? String(job.due_date).slice(0, 10) : '');
              setEditingDue(true);
            }}
          >
            Change due date
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Add file'}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete job
          </button>
          <input ref={fileInput} type="file" hidden accept="image/*,.pdf,.ai,.svg,.eps,.psd" onChange={onFile} />
        </div>
      </Modal>

      {viewing ? (
        <Modal wide title={viewing.file_name} onClose={() => setViewing(null)}>
          <img className="viewer" src={viewing.file_url} alt={viewing.file_name} />
        </Modal>
      ) : null}
      {confirmDelete ? <DeleteDialog job={job} onCancel={() => setConfirmDelete(false)} onDeleted={onClose} /> : null}
    </>
  );
}
