import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Plus, Search } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { MicButton } from '../components/voice-agent/MicButton.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { getOmiSetupStatus } from '../services/today.service.js';
import { listCustomers, listJobs } from '../services/jobs.service.js';
import { useUiStore } from '../store/uiStore.js';
import { formatLongDate } from '../utils/date.js';

const titles = [
  { test: (path) => path === '/', title: 'Today' },
  { test: (path) => path === '/jobs/new', title: 'Jobs' },
  { test: (path) => /^\/jobs\/(?!new$).+/.test(path), title: 'Job' },
  { test: (path) => path.startsWith('/jobs'), title: 'Jobs' },
  { test: (path) => path.startsWith('/customers'), title: 'Customers' },
  { test: (path) => path.startsWith('/voice'), title: 'Voice' },
  { test: (path) => path.startsWith('/board'), title: 'Board' },
];

export function Topbar({ onNewJob, voice }) {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [omi, setOmi] = useState(null);
  const [menu, setMenu] = useState(false);
  const [hits, setHits] = useState({ jobs: [], customers: [] });
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const meRef = useRef(null);
  const pageTitle = useUiStore((state) => state.pageTitle);
  const toggleNav = useUiStore((state) => state.toggleNav);
  const title = pageTitle || titles.find((item) => item.test(location.pathname))?.title || 'Today';

  const refreshOmi = useCallback(() => {
    getOmiSetupStatus()
      .then(setOmi)
      .catch(() => setOmi({ configured: false }));
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
      if (!meRef.current?.contains(event.target)) setMenu(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const connected = (omi?.devices?.length ?? omi?.profiles_with_omi ?? 0) > 0;
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
      <button type="button" className="menu-btn" onClick={toggleNav} aria-label="Open menu">
        <Menu />
      </button>
      <h1>{title}</h1>
      <span className="date">{formatLongDate()}</span>
      <div className="spacer" />
      <div className="search-wrap" ref={boxRef}>
        <form
          className="search"
          onSubmit={(event) => {
            event.preventDefault();
            const q = query.trim();
            go(q ? `/jobs?search=${encodeURIComponent(q)}&assigned=all` : '/jobs');
          }}
        >
          <Search />
          <input
            type="search"
            placeholder="Find a job or customer"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
          />
        </form>
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
        <span className="dot" />
        {connected ? 'OMI on' : omi?.configured ? 'OMI ready' : 'OMI off'}
      </div>
      <MicButton
        hidden={!voice?.enabled}
        status={voice?.status || 'off'}
        onToggle={voice?.onToggle}
      />
      <Button onClick={onNewJob}>
        <Plus />
        <span className="btn-label">New job</span>
      </Button>
      <div className="me" ref={meRef}>
        <button type="button" onClick={() => setMenu((openMenu) => !openMenu)} aria-label="Account">
          <Avatar name={profile?.full_name} />
        </button>
        {menu ? (
          <div className="me-menu">
            <div className="me-name">{profile?.full_name}</div>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                logout();
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
