import { NavLink } from 'react-router-dom';
import { Clock, LayoutList, LogOut, Mic, Monitor, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { listPendingVoice } from '../services/today.service.js';
import { useUiStore } from '../store/uiStore.js';

const links = [
  { to: '/', label: 'Today', icon: Clock, end: true },
  { to: '/jobs', label: 'Jobs', icon: LayoutList },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/voice', label: 'Voice', icon: Mic, badge: true },
  { to: '/board', label: 'Board', icon: Monitor },
];

function NavItem({ to, label, icon: Icon, end, badge, onClick }) {
  return (
    <NavLink to={to} end={end} onClick={onClick} className={({ isActive }) => (isActive ? 'active' : '')}>
      <Icon />
      <span>{label}</span>
      {badge ? <em className="badge">{badge}</em> : null}
    </NavLink>
  );
}

export function Sidebar() {
  const { profile, logout } = useAuth();
  const [pending, setPending] = useState(0);
  const navOpen = useUiStore((state) => state.navOpen);
  const closeNav = useUiStore((state) => state.closeNav);

  const refresh = useCallback(() => {
    listPendingVoice()
      .then((result) => setPending(result.total || 0))
      .catch(() => setPending(0));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useSocket(refresh);

  return (
    <aside className={`sidebar${navOpen ? ' open' : ''}`} aria-label="Staff navigation">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div>
          <div className="brand-name">Print Shop</div>
          <div className="brand-sub">Staff</div>
        </div>
      </div>
      <nav className="nav">
        {links.map((link) => (
          <NavItem
            key={link.to}
            {...link}
            badge={link.badge && pending ? pending : null}
            onClick={closeNav}
          />
        ))}
      </nav>
      <div className="sidebar-foot">
        <Avatar name={profile?.full_name} />
        <div className="who">
          {profile?.full_name || 'Staff'}
          <span>{profile?.email}</span>
        </div>
        <button
          type="button"
          className="sidebar-logout"
          onClick={() => {
            closeNav();
            logout();
          }}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
