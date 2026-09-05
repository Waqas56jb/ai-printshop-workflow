import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  List,
  Users,
  Monitor,
  Activity,
  Mic,
  UserPlus,
  Settings,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { getBoardStats } from '../services/board.service.js';
import { listJobs, listVoiceHistory } from '../services/dashboard.service.js';
import { useSocket } from '../hooks/useSocket.js';
import { useSettingsStore } from '../store/settingsStore.js';
import { useUiStore } from '../store/uiStore.js';
import { initials } from '../utils/format.js';

const primary = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/jobs', label: 'Jobs', icon: List, badgeKey: 'jobs' },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/board', label: 'Job board', icon: Monitor },
];

const setup = [
  { to: '/stages', label: 'Workflow stages', icon: Activity },
  { to: '/voice', label: 'Voice & OMI', icon: Mic },
  { to: '/staff', label: 'Staff', icon: UserPlus },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ to, label, icon: Icon, end, badge, live, onClick }) {
  return (
    <NavLink to={to} end={end} onClick={onClick} className={({ isActive }) => (isActive ? 'active' : '')}>
      <Icon />
      {label}
      {live ? <i className="nav-live" /> : null}
      {badge ? <span className="badge">{badge}</span> : null}
    </NavLink>
  );
}

export function Sidebar() {
  const { profile } = useAuth();
  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const [jobBadge, setJobBadge] = useState(null);
  const [voiceBadge, setVoiceBadge] = useState(null);
  const [boardLive, setBoardLive] = useState(false);
  const shopName = settings.business_name || 'Print Shop';
  const logoUrl = settings.business_logo_url;
  const navOpen = useUiStore((state) => state.navOpen);
  const closeNav = useUiStore((state) => state.closeNav);

  const refreshBadges = useCallback(() => {
    listJobs({ status: 'active', limit: 1, page: 1 })
      .then((result) => setJobBadge(result.total || null))
      .catch(() => setJobBadge(null));
    listVoiceHistory({ status: 'pending_confirmation', limit: 1, page: 1 })
      .then((result) => setVoiceBadge(result.total || null))
      .catch(() => setVoiceBadge(null));
  }, []);

  useEffect(() => {
    refreshBadges();
    loadSettings().catch(() => {});
    getBoardStats()
      .then((stats) => setBoardLive(Boolean(stats?.live)))
      .catch(() => setBoardLive(false));
  }, [refreshBadges, loadSettings]);

  const onSocket = useCallback(
    (payload, event) => {
      if (event === 'board:screens') {
        const list = Array.isArray(payload) ? payload : [];
        setBoardLive(list.some((row) => row.online));
        return;
      }
      refreshBadges();
    },
    [refreshBadges]
  );
  useSocket(onSocket);

  return (
    <aside className={`sidebar${navOpen ? ' open' : ''}`}>
      <div className="brand">
        <div className={`brand-mark ${logoUrl ? 'has-logo' : ''}`.trim()}>
          {logoUrl ? <img src={logoUrl} alt="" /> : initials(shopName).slice(0, 1) || 'P'}
        </div>
        <div>
          <div className="brand-name">{shopName}</div>
          <div className="brand-sub">Admin</div>
        </div>
      </div>
      <nav className="nav">
        {primary.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            badge={item.badgeKey === 'jobs' ? jobBadge : null}
            live={item.to === '/board' ? boardLive : false}
            onClick={closeNav}
          />
        ))}
        <div className="nav-section">Setup</div>
        {setup.map((item) => (
          <NavItem key={item.to} {...item} badge={item.to === '/voice' ? voiceBadge : null} onClick={closeNav} />
        ))}
      </nav>
      <div className="sidebar-foot">
        <Avatar name={profile?.full_name} />
        <div className="who">
          {profile?.full_name || 'Admin'}
          <span>{profile?.email}</span>
        </div>
      </div>
    </aside>
  );
}
