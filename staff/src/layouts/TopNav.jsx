import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Clock, LayoutList, Mic, Monitor, Plus, Search, Users } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { getOmiSetupStatus, listPendingVoice } from '../services/today.service.js';

const links = [
  { to: '/', label: 'Today', icon: Clock, end: true },
  { to: '/jobs', label: 'Jobs', icon: LayoutList },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/voice', label: 'Voice', icon: Mic, badge: true },
  { to: '/board', label: 'Board', icon: Monitor },
];

export function TopNav({ onNewJob }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [omi, setOmi] = useState(null);
  const [pending, setPending] = useState(0);
  const [menu, setMenu] = useState(false);

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

  const connected = Boolean(omi?.configured);

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
      <form
        className="search"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(query.trim() ? `/jobs?q=${encodeURIComponent(query.trim())}` : '/jobs');
        }}
      >
        <Search />
        <input
          placeholder="Find a job or customer"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <div className={`omi ${connected ? '' : 'off'}`.trim()}>
        <span className="dot"></span>
        {connected ? 'OMI on' : 'OMI off'}
      </div>
      <Button onClick={onNewJob}>
        <Plus />
        New job
      </Button>
      <div className="me">
        <button type="button" onClick={() => setMenu((open) => !open)} aria-label="Account">
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
