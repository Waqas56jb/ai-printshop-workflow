import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { announceJobsChanged } from '../../hooks/useJobBoard.js';
import { addJobFile, createCustomer, createJob, listCustomers } from '../../services/jobs.service.js';
import { errorWords } from '../../utils/plain.js';
import { Modal } from '../Modal.jsx';

// Existing customer with this exact name, or a new one.
async function customerIdFor(name) {
  const clean = name.trim().replace(/\s+/g, ' ');
  const found = await listCustomers({ search: clean, page: 1, limit: 50 });
  const match = (found.items || []).find((row) => row.name.trim().toLowerCase() === clean.toLowerCase());
  if (match) return match.id;
  const created = await createCustomer({ name: clean });
  return created.id;
}

export function NewJobModal({ onClose }) {
  const [customer, setCustomer] = useState('');
  const [what, setWhat] = useState('');
  const [quantity, setQuantity] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [file, setFile] = useState(null);
  const [names, setNames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      if (file) {
        try {
          await addJobFile(job.id, file);
        } catch (err) {
          toast(`The job was made, but the file did not upload: ${errorWords(err)}`);
        }
      }
      announceJobsChanged();
      toast(`New job for ${customer.trim()} — ${job.job_number}`);
      onClose();
    } catch (err) {
      setError(errorWords(err, 'Could not make the job. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New job" onClose={onClose}>
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
            autoFocus
          />
          <datalist id="customer-names">
            {names.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>What are we making?</span>
          <input className="input" value={what} onChange={(event) => setWhat(event.target.value)} placeholder="T-shirts with logo" />
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
        <label className="field">
          <span>
            Design file <small>(optional)</small>
          </span>
          <span className="file-pick">
            <input type="file" accept="image/*,.pdf,.ai,.svg,.eps,.psd" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            {file ? `📎 ${file.name}` : 'Tap to choose a file'}
          </span>
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Make job'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
