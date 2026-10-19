import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useVoiceStatus } from '../hooks/useVoiceStatus.js';
import { Icon } from './Icon.jsx';
import { MoreDialog } from './MoreDialog.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/jobs', label: 'Jobs', icon: 'jobs' },
  { to: '/files', label: 'Files', icon: 'folder' },
  { to: '/customers', label: 'Customers', icon: 'customers' },
  { to: '/voice', label: 'Voice', icon: 'voice' },
  { to: '/team', label: 'Team', icon: 'team', adminOnly: true },
];

function heardWords(at, now) {
  if (!at) return 'Nothing heard yet';
  const mins = Math.floor((now - at) / 60000);
  if (mins < 1) return 'Heard just now';
  if (mins < 60) return `Heard ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Heard ${hours} hr ago`;
  return `Heard ${Math.floor(hours / 24)} days ago`;
}

export function Sidebar() {
  const { profile, logout } = useAuth();
  const { on, heardAt, now } = useVoiceStatus();
  const navigate = useNavigate();
  const [linksOpen, setLinksOpen] = useState(false);

  async function signOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="side">
      <Link to="/" className="brand">
        <span className="mark">P</span>
        <b>Print Shop</b>
      </Link>
      <nav className="nav" aria-label="Main">
        {NAV.filter((item) => !item.adminOnly || profile?.role === 'admin').map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'on' : undefined)}>
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Link to="/voice" className={`side-voice${on ? ' on' : ''}`}>
        <i />
        <div>
          <b>{on ? 'Voice is on' : 'Voice is quiet'}</b>
          <span>{heardWords(heardAt, now)}</span>
        </div>
      </Link>
      <div className="side-foot">
        <span className="who">{profile?.full_name || profile?.email || ''}</span>
        <button type="button" onClick={() => setLinksOpen(true)} aria-label="TV and OMI links" title="TV and OMI links">
          Links
        </button>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </div>
      {linksOpen ? <MoreDialog onClose={() => setLinksOpen(false)} /> : null}
    </aside>
  );
}
