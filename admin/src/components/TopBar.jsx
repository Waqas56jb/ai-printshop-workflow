import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useVoiceStatus } from '../hooks/useVoiceStatus.js';
import { MoreDialog } from './MoreDialog.jsx';
import { NewJobModal } from './jobs/NewJobModal.jsx';

const TABS = [
  { to: '/', label: 'Jobs', end: true },
  { to: '/files', label: 'Files' },
  { to: '/customers', label: 'Customers' },
  { to: '/voice', label: 'Voice' },
];

export function TopBar() {
  const { on } = useVoiceStatus();
  const [newOpen, setNewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
          Print Shop
        </Link>
        <nav className="tabs" aria-label="Main">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <Link to="/voice" className={`voice-pill${on ? ' on' : ''}`} title={on ? 'The OMI was heard in the last 10 minutes' : 'Nothing heard from the OMI in the last 10 minutes'}>
            <i />
            {on ? 'Voice is on' : 'Voice is off'}
          </Link>
          <button type="button" className="btn btn-primary btn-big" onClick={() => setNewOpen(true)}>
            + New job
          </button>
          <button type="button" className="more-btn" onClick={() => setMoreOpen(true)} aria-label="More">
            ⋯
          </button>
        </div>
      </div>
      {newOpen ? <NewJobModal onClose={() => setNewOpen(false)} /> : null}
      {moreOpen ? <MoreDialog onClose={() => setMoreOpen(false)} /> : null}
    </header>
  );
}
