import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { announceJobsChanged } from '../../hooks/useJobBoard.js';
import { useUploads } from '../../hooks/useUploads.js';
import { addJobFile, createCustomer, createJob, listCustomers } from '../../services/jobs.service.js';
import { errorWords } from '../../utils/plain.js';
import { Modal } from '../Modal.jsx';
import { UploadRows } from '../UploadRows.jsx';

// Existing customer with this exact name, or a new one.
async function customerIdFor(name) {
  const clean = name.trim().replace(/\s+/g, ' ');
  const found = await listCustomers({ search: clean, page: 1, limit: 50 });
  const match = (found.items || []).find((row) => row.name.trim().toLowerCase() === clean.toLowerCase());
  if (match) return match.id;
  const created = await createCustomer({ name: clean });
  return created.id;
}

function sizeWords(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function NewJobModal({ onClose, initialCustomer = '', onCreated }) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [what, setWhat] = useState('');
  const [quantity, setQuantity] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [files, setFiles] = useState([]);
  const [names, setNames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState(null);
  const fileInput = useRef(null);
  const uploads = useUploads();

  // Suggest existing customers while typing.
  useEffect(() => {
    const query = customer.trim();
    if (query.length < 2) {
      setNames([]);
      return undefined;
    }
    const id = setTimeout(() => {
      listCustomers({ search: query, page: 1, limit: 8 })
        .then((result) => setNames((result.items || []).map((row) => row.name)))
        .catch(() => setNames([]));
    }, 200);
    return () => clearTimeout(id);
  }, [customer]);

  function addFiles(list) {
    const picked = Array.from(list || []);
    setFiles((current) => [...current, ...picked]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!customer.trim()) return setError('Please type the customer name.');
    if (!what.trim()) return setError('Please say what we are making.');
    setError('');
    setSaving(true);
    try {
      const customer_id = await customerIdFor(customer);
      const job = await createJob({
        customer_id,
        title: what.trim(),
        quantity: Number(quantity) > 0 ? Number(quantity) : 1,
        due_date: dueDate || undefined,
      });
      setMade(job);
      announceJobsChanged();
      onCreated?.(job);
      const done = files.length ? await uploads.run(files, (file, onPct) => addJobFile(job.id, file, onPct)) : 0;
      announceJobsChanged();
      if (done < files.length) {
        // Keep the dialog open so the failed files and their reasons can be read.
        toast(`New job ${job.job_number} made — ${files.length - done} file${files.length - done === 1 ? '' : 's'} did not upload`);
        return;
      }
      toast(`New job for ${customer.trim()} — ${job.job_number}${done ? ` with ${done} file${done === 1 ? '' : 's'}` : ''}`);
      onClose();
    } catch (err) {
      setError(errorWords(err, 'Could not make the job. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  if (made && !saving) {
    return (
      <Modal title={`${made.job_number} is made`} onClose={onClose}>
        <p style={{ fontSize: 18, marginBottom: 14 }}>
          Some files did not upload. You can add them again from the job card.
        </p>
        <UploadRows rows={uploads.rows} />
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New job" onClose={saving ? undefined : onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>Customer</span>
          <input
            className="input"
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
            list="customer-names"
            placeholder="Sarah Khan"
            autoComplete="off"
            autoFocus={!initialCustomer}
          />
          <datalist id="customer-names">
            {names.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>What are we making?</span>
          <input
            className="input"
            value={what}
            onChange={(event) => setWhat(event.target.value)}
            placeholder="T-shirts with logo"
            autoFocus={Boolean(initialCustomer)}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>How many</span>
            <input
              className="input"
              type="number"
              min="1"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="1"
            />
          </label>
          <label className="field">
            <span>
              Ready by <small>(optional)</small>
            </span>
            <input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
        </div>
        <div className="field">
          <span>
            Design files <small>(optional — any kind, as many as you like, up to 50 MB each)</small>
          </span>
          <button
            type="button"
            className="file-pick"
            style={{ width: '100%' }}
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
          >
            📎 {files.length ? 'Add more files' : 'Tap to choose files, or drop them here'}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
          {files.length ? (
            <ul className="pick-list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span>
                    {file.name} <small>{sizeWords(file.size)}</small>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    disabled={saving}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <UploadRows rows={uploads.rows} />
        {error ? <p className="error-text">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (files.length ? 'Uploading…' : 'Saving…') : 'Make job'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
