import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { createCustomer, createJob, listCustomers, updateJob, uploadArtwork } from '../../services/jobs.service.js';

const PRODUCTS = ['T-Shirt', 'Hoodie', 'Flyer', 'Business card', 'Banner', 'Sticker', 'Other'];
const PRINTS = ['Screen print', 'DTF', 'DTG', 'Sublimation', 'Digital', 'Offset'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const emptyForm = {
  customer_id: '',
  customer_name: '',
  title: '',
  product_type: 'T-Shirt',
  quantity: '',
  print_type: 'Screen print',
  due_date: '',
  priority: 'normal',
  assigned_to: '',
  price: '',
  size_details: '',
};

export function JobDrawer({ open, job, prefillCustomer, users = [], onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [matches, setMatches] = useState([]);
  const [showCombo, setShowCombo] = useState(false);
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (job) {
      setForm({
        customer_id: job.customer_id || '',
        customer_name: job.customer?.name || '',
        title: job.title || '',
        product_type: job.product_type || 'T-Shirt',
        quantity: job.quantity ?? '',
        print_type: job.print_type || 'Screen print',
        due_date: job.due_date || '',
        priority: job.priority || 'normal',
        assigned_to: job.assigned_to || '',
        price: job.price ?? '',
        size_details: job.size_details || '',
      });
    } else if (prefillCustomer) {
      setForm({
        ...emptyForm,
        customer_id: prefillCustomer.id,
        customer_name: prefillCustomer.name,
      });
    } else {
      setForm(emptyForm);
    }
    setFiles([]);
    setProgress({});
    setError('');
  }, [open, job, prefillCustomer]);

  useEffect(() => {
    if (!open) return undefined;
    const q = form.customer_name.trim();
    const timer = setTimeout(async () => {
      const result = await listCustomers({ search: q, page: 1, limit: 8 });
      setMatches(result.items || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [form.customer_name, open]);

  const exactMatch = useMemo(
    () => matches.find((item) => item.name.toLowerCase() === form.customer_name.trim().toLowerCase()),
    [matches, form.customer_name]
  );

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function resolveCustomer() {
    if (form.customer_id && exactMatch?.id === form.customer_id) return form.customer_id;
    if (exactMatch) return exactMatch.id;
    const name = form.customer_name.trim();
    if (!name) throw new Error('Customer is required');
    const created = await createCustomer({ name });
    return created.id;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const customer_id = await resolveCustomer();
      const payload = {
        customer_id,
        title: form.title.trim(),
        product_type: form.product_type || null,
        quantity: Number(form.quantity) || 1,
        print_type: form.print_type || null,
        due_date: form.due_date || null,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        price: form.price === '' ? null : Number(form.price),
        size_details: form.size_details || null,
      };

      const saved = job ? await updateJob(job.id, payload) : await createJob(payload);

      for (const file of files) {
        await uploadArtwork(saved.id, file, (pct) => {
          setProgress((current) => ({ ...current, [file.name]: pct }));
        });
      }

      onSaved(saved, job ? 'updated' : 'created');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save job');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={onClose}></div>
      <aside className="drawer">
        <div className="drawer-head">
          <h2>{job ? 'Edit job' : 'New job'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <form className="drawer-body" onSubmit={handleSubmit} id="job-drawer-form">
          {error ? <div className="login-error">{error}</div> : null}
          <div className="f combo">
            <label>Customer</label>
            <label className="field">
              <Search />
              <input
                placeholder="Search or add a customer"
                value={form.customer_name}
                onChange={(event) => {
                  setField('customer_name', event.target.value);
                  setField('customer_id', '');
                  setShowCombo(true);
                }}
                onFocus={() => setShowCombo(true)}
              />
            </label>
            <span className="hint">Type a new name to create the customer with this job</span>
            {showCombo && form.customer_name ? (
              <div className="combo-list">
                {matches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setField('customer_id', item.id);
                      setField('customer_name', item.name);
                      setShowCombo(false);
                    }}
                  >
                    {item.name}
                  </button>
                ))}
                {!exactMatch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setField('customer_id', '');
                      setShowCombo(false);
                    }}
                  >
                    Create ‘{form.customer_name.trim()}’
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="f">
            <label>Job title</label>
            <label className="field">
              <input
                placeholder="e.g. 50 T-Shirts, front logo"
                value={form.title}
                onChange={(event) => setField('title', event.target.value)}
                required
              />
            </label>
          </div>
          <div className="row">
            <div className="f">
              <label>Product type</label>
              <label className="field">
                <select value={form.product_type} onChange={(event) => setField('product_type', event.target.value)}>
                  {PRODUCTS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="f">
              <label>Quantity</label>
              <label className="field">
                <input
                  type="number"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(event) => setField('quantity', event.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="row">
            <div className="f">
              <label>Print type</label>
              <label className="field">
                <select value={form.print_type} onChange={(event) => setField('print_type', event.target.value)}>
                  {PRINTS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="f">
              <label>Due date</label>
              <label className="field">
                <input type="date" value={form.due_date} onChange={(event) => setField('due_date', event.target.value)} />
              </label>
            </div>
          </div>
          <div className="f">
            <label>Priority</label>
            <div className="seg">
              {PRIORITIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={form.priority === item ? 'on' : ''}
                  onClick={() => setField('priority', item)}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <div className="f">
              <label>Assign to</label>
              <label className="field">
                <select value={form.assigned_to} onChange={(event) => setField('assigned_to', event.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="f">
              <label>Price (optional)</label>
              <label className="field">
                <input
                  placeholder="0.00"
                  value={form.price}
                  onChange={(event) => setField('price', event.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="f">
            <label>Size / print details</label>
            <textarea
              placeholder="Sizes, colors, placement, ink…"
              value={form.size_details}
              onChange={(event) => setField('size_details', event.target.value)}
            />
          </div>
          <div className="f">
            <label>Artwork</label>
            <label className="drop">
              <b>Upload files</b> or drag them here
              <small>PNG, JPG, PDF, AI, SVG · up to 20 MB each</small>
              <input
                type="file"
                multiple
                hidden
                accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.ai"
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
            </label>
            {files.map((file) => (
              <div className="file-row" key={file.name}>
                <span>{file.name}</span>
                <span>{progress[file.name] ? `${progress[file.name]}%` : 'Ready'}</span>
              </div>
            ))}
          </div>
        </form>
        <div className="drawer-foot">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="job-drawer-form" disabled={saving}>
            {saving ? 'Saving…' : job ? 'Save job' : 'Create job'}
          </Button>
        </div>
      </aside>
    </>
  );
}
