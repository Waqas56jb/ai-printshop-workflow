import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useUploads } from '../../hooks/useUploads.js';
import { deleteCustomer, getCustomer, listStages, updateCustomer } from '../../services/jobs.service.js';
import { listFiles, openOrDownload, uploadFile } from '../../services/files.service.js';
import { dueLine, errorWords, fileExt, isImageFile } from '../../utils/plain.js';
import { JobSheet } from '../jobs/JobSheet.jsx';
import { NewJobModal } from '../jobs/NewJobModal.jsx';
import { Modal } from '../Modal.jsx';
import { UploadRows } from '../UploadRows.jsx';
import { CustomerForm } from './CustomerForm.jsx';

function DeleteCustomer({ customer, onCancel, onDeleted }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toUpperCase() === 'DELETE';
  return (
    <Modal title={`Delete ${customer.name}?`} onClose={onCancel}>
      <p style={{ fontSize: 18, marginBottom: 14 }}>The customer and their own files will be gone for good.</p>
      <label className="field">
        <span>Type DELETE to confirm</span>
        <input className="input" value={typed} onChange={(event) => setTyped(event.target.value)} autoFocus autoComplete="off" />
      </label>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Keep
        </button>
        <button
          type="button"
          className="btn btn-danger-solid"
          disabled={!ok || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await deleteCustomer(customer.id);
              toast(`${customer.name} was deleted`);
              onDeleted();
            } catch (err) {
              toast(errorWords(err));
              setBusy(false);
            }
          }}
        >
          {busy ? 'Deleting…' : 'Delete customer'}
        </button>
      </div>
    </Modal>
  );
}

// One customer: details, their jobs, and their artwork (general or for a job).
export function CustomerSheet({ customerId, version, onClose, onChanged }) {
  const [customer, setCustomer] = useState(null);
  const [files, setFiles] = useState(null);
  const [stages, setStages] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState('');
  const [openJob, setOpenJob] = useState(null);
  const [newJob, setNewJob] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState(null);
  const fileInput = useRef(null);
  const uploads = useUploads();

  const load = useCallback(async () => {
    try {
      const [detail, listing] = await Promise.all([getCustomer(customerId), listFiles(`c:${customerId}`)]);
      setCustomer(detail);
      setFiles(listing);
      setError('');
    } catch (err) {
      setError(err.response?.status === 404 ? 'This customer is no longer here.' : errorWords(err));
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load, version]);

  useEffect(() => {
    listStages().then(setStages).catch(() => setStages([]));
  }, []);

  async function save(values) {
    await updateCustomer(customerId, values);
    toast('Saved');
    setEditing(false);
    await load();
    onChanged?.();
  }

  async function onPick(event) {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;
    const path = target || `c:${customerId}`;
    const done = await uploads.run(picked, (file, onPct) => uploadFile(path, file, onPct));
    if (done) {
      const where = target ? customer.jobs.find((job) => `j:${job.id}` === target)?.job_number : customer.name;
      toast(`${done} file${done === 1 ? '' : 's'} added for ${where}`);
      await load();
      onChanged?.();
    }
  }

  if (!customer) {
    return (
      <Modal title={error ? 'Customer' : 'Loading…'} onClose={onClose}>
        {error ? <p className="banner-error">{error}</p> : <p className="loading">Loading…</p>}
      </Modal>
    );
  }

  const jobs = customer.jobs || [];
  const looseFiles = (files?.items || []).filter((item) => item.type === 'file');
  const ownFolders = (files?.items || []).filter((item) => item.type === 'folder' && !item.auto);
  const jobFolders = new Map((files?.items || []).filter((item) => item.job).map((item) => [item.id, item]));

  return (
    <>
      <Modal wide title={customer.name} onClose={onClose}>
        {editing ? (
          <CustomerForm initial={customer} action="Save changes" onSave={save} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <div className="sheet-facts">
              {customer.company ? (
                <div>
                  <b>Business</b> {customer.company}
                </div>
              ) : null}
              <div>
                <b>Phone</b> {customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : 'No phone saved'}
              </div>
              <div>
                <b>Email</b> {customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : 'No email saved'}
              </div>
              {customer.notes ? (
                <div>
                  <b>Notes</b> {customer.notes}
                </div>
              ) : null}
            </div>
            <div className="sheet-buttons" style={{ marginTop: 16 }}>
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                Edit details
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setNewJob(true)}>
                + New job for {customer.name.split(/\s+/)[0]}
              </button>
            </div>
          </>
        )}

        <div className="sheet-section">
          <h3>Jobs ({jobs.length})</h3>
          {jobs.length ? (
            <ul className="job-rows">
              {jobs.map((job) => {
                const due = dueLine(job);
                const folder = jobFolders.get(`j:${job.id}`);
                return (
                  <li key={job.id}>
                    <button type="button" onClick={() => setOpenJob(job.id)}>
                      <span className="stage-badge" style={{ '--stage': job.stage?.color || '#8a93a1', marginBottom: 0 }}>
                        {job.status === 'completed' ? 'Done' : job.stage?.name || '—'}
                      </span>
                      <b>
                        {job.job_number} · {job.title}
                      </b>
                      <span className={`card-due ${due.tone}`} style={{ marginTop: 0 }}>
                        {due.text}
                      </span>
                      {folder ? <span className="hint">{folder.sub}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="hint">No jobs yet.</p>
          )}
        </div>

        <div className="sheet-section">
          <h3>Artwork &amp; files</h3>
          <div className="upload-target">
            <label className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
              <span>Upload for</span>
              <select className="input" value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">{customer.name} (not for one job)</option>
                {jobs.map((job) => (
                  <option key={job.id} value={`j:${job.id}`}>
                    {job.job_number} · {job.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileInput.current?.click()}
              disabled={uploads.busy}
              style={{ alignSelf: 'flex-end' }}
            >
              {uploads.busy ? 'Uploading…' : 'Upload files'}
            </button>
            <input ref={fileInput} type="file" multiple hidden onChange={onPick} />
          </div>
          <p className="hint" style={{ margin: '8px 0 12px' }}>
            Any kind of file, as many as you like, up to 50 MB each. Files for a job also show on its card and on the TV.
          </p>
          <UploadRows rows={uploads.rows} />
          {looseFiles.length ? (
            <div className="thumbs">
              {looseFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className="thumb"
                  title={file.name}
                  onClick={() =>
                    isImageFile({ file_type: file.file_type, file_name: file.name }) && file.url
                      ? setViewing(file)
                      : openOrDownload(file).catch((err) => toast(errorWords(err)))
                  }
                >
                  {isImageFile({ file_type: file.file_type, file_name: file.name }) && file.url ? (
                    <img src={file.url} alt={file.name} loading="lazy" />
                  ) : (
                    <>
                      <span className="ext">{fileExt({ file_name: file.name })}</span>
                      <span className="name">{file.name}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">No general files yet{jobs.length ? ' — job files are inside each job.' : '.'}</p>
          )}
          <p style={{ marginTop: 12 }}>
            <Link to={`/files?path=c:${customer.id}`} className="text-link" onClick={onClose}>
              Open {customer.name}’s folder in Files
              {ownFolders.length ? ` (${ownFolders.length} folder${ownFolders.length === 1 ? '' : 's'})` : ''} →
            </Link>
          </p>
        </div>

        <div className="sheet-buttons">
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete customer
          </button>
        </div>
      </Modal>

      {openJob ? (
        <JobSheet
          jobId={openJob}
          stages={stages}
          version={version}
          onClose={() => {
            setOpenJob(null);
            load();
          }}
        />
      ) : null}
      {newJob ? (
        <NewJobModal
          initialCustomer={customer.name}
          onClose={() => {
            setNewJob(false);
            load();
            onChanged?.();
          }}
        />
      ) : null}
      {viewing ? (
        <Modal wide title={viewing.name} onClose={() => setViewing(null)}>
          <img className="viewer" src={viewing.url} alt={viewing.name} />
        </Modal>
      ) : null}
      {confirmDelete ? (
        <DeleteCustomer
          customer={customer}
          onCancel={() => setConfirmDelete(false)}
          onDeleted={() => {
            setConfirmDelete(false);
            onChanged?.();
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
