import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Clock, LayoutList, Mic, Monitor, Plus, Search, Users } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { MicButton } from '../components/voice-agent/MicButton.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { getOmiSetupStatus, listPendingVoice } from '../services/today.service.js';
import { listCustomers, listJobs } from '../services/jobs.service.js';

const links = [
  { to: '/', label: 'Today', icon: Clock, end: true },
  { to: '/jobs', label: 'Jobs', icon: LayoutList },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/voice', label: 'Voice', icon: Mic, badge: true },
  { to: '/board', label: 'Board', icon: Monitor },
];

export function TopNav({ onNewJob, voice }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [omi, setOmi] = useState(null);
  const [pending, setPending] = useState(0);
  const [menu, setMenu] = useState(false);
  const [hits, setHits] = useState({ jobs: [], customers: [] });
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const refresh = useCallback(() => {
    getOmiSetupStatus()
      .then(setOmi)
      .catch(() => setOmi({ configured: false }));
    listPendingVoice()
      .then((result) => setPending(result.total || 0))
      .catch(() => setPending(0));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useSocket(refresh);

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
    <header className="topnav">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div>
          <b>Print Shop</b>
          <span>Staff</span>
        </div>
      </div>
      <nav className="nav">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? 'on' : '')}>
            <link.icon />
            <span>{link.label}</span>
            {link.badge && pending ? <span className="badge">{pending}</span> : null}
          </NavLink>
        ))}
      </nav>
      <div className="spacer"></div>
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
        <span className="dot"></span>
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
      <div className="me">
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
      <nav className="bottom-nav" aria-label="Staff">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? 'on' : '')}>
            <link.icon />
            <span>{link.label}</span>
            {link.badge && pending ? <i className="badge">{pending}</i> : null}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
