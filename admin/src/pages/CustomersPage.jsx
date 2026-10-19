import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CustomerForm } from '../components/customers/CustomerForm.jsx';
import { CustomerSheet } from '../components/customers/CustomerSheet.jsx';
import { Icon } from '../components/Icon.jsx';
import { Modal } from '../components/Modal.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useSocket } from '../hooks/useSocket.js';
import { createCustomer, listCustomers } from '../services/jobs.service.js';
import { errorWords } from '../utils/plain.js';

const PAGE = 100;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastJobWords(value) {
  if (!value) return 'No jobs yet';
  const date = new Date(value);
  return `Last job ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export default function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const timer = useRef(null);

  const load = useCallback(
    async (nextPage = 1) => {
      try {
        const result = await listCustomers({ search: search.trim() || undefined, page: nextPage, limit: PAGE, sort: 'name' });
        setItems((current) => (nextPage === 1 ? result.items || [] : [...current, ...(result.items || [])]));
        setTotal(result.total || 0);
        setPage(nextPage);
        setError('');
      } catch (err) {
        setError(errorWords(err, 'Could not load customers.'));
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  // Search as you type (a short pause so every key press isn't a request).
  useEffect(() => {
    const id = setTimeout(() => load(1), 250);
    return () => clearTimeout(id);
  }, [load]);

  const onLive = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setVersion((value) => value + 1);
      load(1);
    }, 300);
  }, [load]);
  useSocket(onLive);

  function open(id) {
    setParams(id ? { open: id } : {});
  }

  async function create(values) {
    const customer = await createCustomer(values);
    toast(`${customer.name} added`);
    setCreating(false);
    await load(1);
    open(customer.id);
  }

  return (
    <>
      <PageHeader title="Customers">
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a name, phone or business"
            aria-label="Find a customer"
          />
        </label>
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + New customer
        </button>
      </PageHeader>

      <main className="content">
        {error ? <div className="banner-error">{error}</div> : null}
        {loading && !items.length ? (
          <div className="loading">Loading customers…</div>
        ) : items.length ? (
          <>
            <p className="hint" style={{ marginBottom: 14 }}>
              {total} customer{total === 1 ? '' : 's'}
              {search.trim() ? ` matching “${search.trim()}”` : ''}
            </p>
            <div className="cust-grid">
              {items.map((customer) => {
                const active = customer.active_jobs?.length || 0;
                return (
                  <button key={customer.id} type="button" className="cust-card" onClick={() => open(customer.id)}>
                    <span className="avatar">{customer.name.trim().charAt(0).toUpperCase()}</span>
                    <span className="cust-body">
                      <b>{customer.name}</b>
                      {customer.company ? <span className="cust-sub">{customer.company}</span> : null}
                      <span className="cust-sub">{customer.phone || 'No phone saved'}</span>
                      <span className="cust-meta">
                        {customer.total_jobs} job{customer.total_jobs === 1 ? '' : 's'}
                        {active ? ` · ${active} in progress` : ''} · {lastJobWords(customer.last_job_at)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {items.length < total ? (
              <div style={{ textAlign: 'center', marginTop: 18 }}>
                <button type="button" className="btn" onClick={() => load(page + 1)}>
                  Show more customers
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="placeholder">
            <h2>{search.trim() ? 'No customer found' : 'No customers yet'}</h2>
            <p>{search.trim() ? 'Try another name, or add them as a new customer.' : 'Press “+ New customer” to add the first one.'}</p>
          </div>
        )}
      </main>

      {creating ? (
        <Modal title="New customer" onClose={() => setCreating(false)}>
          <CustomerForm action="Add customer" onSave={create} onCancel={() => setCreating(false)} />
        </Modal>
      ) : null}
      {openId ? (
        <CustomerSheet customerId={openId} version={version} onClose={() => open(null)} onChanged={() => load(1)} />
      ) : null}
    </>
  );
}
