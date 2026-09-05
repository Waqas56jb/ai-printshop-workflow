import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { useSocket } from '../hooks/useSocket.js';
import { getOmiSetupStatus, listJobs } from '../services/dashboard.service.js';
import { listCustomers } from '../services/jobs.service.js';
import { useUiStore } from '../store/uiStore.js';
import { formatLongDate } from '../utils/date.js';

const titles = [
  { test: (path) => path === '/', title: 'Dashboard' },
  { test: (path) => path === '/jobs/new', title: 'Jobs' },
  { test: (path) => /^\/jobs\/(?!new$).+/.test(path), title: 'Job' },
  { test: (path) => path.startsWith('/jobs'), title: 'Jobs' },
  { test: (path) => path.startsWith('/customers'), title: 'Customers' },
  { test: (path) => path.startsWith('/board'), title: 'Job board' },
  { test: (path) => path.startsWith('/stages'), title: 'Workflow stages' },
  { test: (path) => path.startsWith('/voice'), title: 'Voice & OMI' },
  { test: (path) => path.startsWith('/staff'), title: 'Staff' },
  { test: (path) => path.startsWith('/settings'), title: 'Settings' },
];

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [omi, setOmi] = useState(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState({ jobs: [], customers: [] });
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const pageTitle = useUiStore((state) => state.pageTitle);
  const title = pageTitle || titles.find((item) => item.test(location.pathname))?.title || 'Dashboard';

  const refreshOmi = useCallback(() => {
    getOmiSetupStatus()
      .then(setOmi)
      .catch(() => setOmi({ configured: false, profiles_with_omi: 0 }));
  }, []);

  useEffect(() => {
    refreshOmi();
  }, [refreshOmi]);
  useSocket(refreshOmi);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits({ jobs: [], customers: [] });
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const [jobs, customers] = await Promise.all([
          listJobs({ search: q, page: 1, limit: 5 }),
          listCustomers({ search: q, page: 1, limit: 5 }),
        ]);
        setHits({ jobs: jobs.items || [], customers: customers.items || [] });
        setOpen(true);
      } catch {
        setHits({ jobs: [], customers: [] });
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onDoc(event) {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const connected = Boolean(omi?.configured);
  const devices = omi?.profiles_with_omi ?? 0;
  const showHits = open && query.trim().length >= 2;
  const empty = showHits && !hits.jobs.length && !hits.customers.length;

  function go(path) {
    setQuery('');
    setOpen(false);
    setHits({ jobs: [], customers: [] });
    navigate(path);
  }

  return (
    <header className="topbar">
      <h1>{title}</h1>
      <span className="date">{formatLongDate()}</span>
      <div className="spacer"></div>
      <div className="search-wrap" ref={boxRef}>
        <label className="search">
          <Search />
          <input
            type="search"
            placeholder="Search jobs, customers…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
          />
        </label>
        {showHits ? (
          <div className="search-pop">
            {hits.jobs.map((job) => (
              <button key={job.id} type="button" onClick={() => go(`/jobs/${job.id}`)}>
                <b>{job.job_number}</b>
                <span>{job.title || job.customer?.name || 'Job'}</span>
              </button>
            ))}
            {hits.customers.map((customer) => (
              <button key={customer.id} type="button" onClick={() => go(`/customers/${customer.id}`)}>
                <b>{customer.name}</b>
                <span>Customer</span>
              </button>
            ))}
            {empty ? <div className="search-empty">No matches</div> : null}
          </div>
        ) : null}
      </div>
      <div className={`omi ${connected ? '' : 'off'}`.trim()}>
        <span className="dot"></span>
        {connected ? `OMI connected · ${devices} device${devices === 1 ? '' : 's'}` : 'OMI not configured'}
      </div>
      <Button onClick={() => navigate('/jobs/new')}>
        <Plus />
        New job
      </Button>
    </header>
  );
}
