import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { JobDrawer } from '../components/jobs/JobDrawer.jsx';
import { VoiceAgentPanel } from '../components/voice-agent/VoiceAgentPanel.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useRealtimeAgent } from '../hooks/useRealtimeAgent.js';
import { listUsers } from '../services/jobs.service.js';
import { getRealtimeConfig } from '../services/realtime.service.js';
import { useUiStore } from '../store/uiStore.js';
import { useVoiceAgentStore } from '../store/voiceAgentStore.js';
import { REALTIME_ENABLED } from '../config.js';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

export function AppLayout() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [drawer, setDrawer] = useState({ open: false, prefill: null });
  const agent = useRealtimeAgent();
  const setEnabled = useVoiceAgentStore((state) => state.setEnabled);
  const navOpen = useUiStore((state) => state.navOpen);
  const closeNav = useUiStore((state) => state.closeNav);

  useEffect(() => {
    listUsers({ lite: true })
      .then((rows) => setUsers((rows || []).filter((user) => user.is_active !== false && user.role !== 'worker')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!REALTIME_ENABLED) {
      setEnabled(false);
      return;
    }
    getRealtimeConfig()
      .then((config) => setEnabled(config?.enabled !== false))
      .catch(() => setEnabled(true));
  }, [setEnabled]);

  useEffect(() => {
    document.body.classList.toggle('nav-lock', navOpen);
    return () => document.body.classList.remove('nav-lock');
  }, [navOpen]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 900) closeNav();
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [closeNav]);

  const openJob = useCallback((prefill = null) => {
    setDrawer({ open: true, prefill });
  }, []);

  return (
    <div className="staff-app">
      {navOpen ? <div className="nav-scrim" onClick={closeNav} /> : null}
      <Sidebar />
      <div className="main">
        <Topbar
          onNewJob={() => openJob(null)}
          voice={{
            enabled: REALTIME_ENABLED && agent.enabled,
            status: agent.status,
            onToggle: agent.toggle,
          }}
        />
        <Outlet context={{ openJob }} />
      </div>
      <VoiceAgentPanel
        open={agent.open || Boolean(agent.error)}
        status={agent.status}
        muted={agent.muted}
        error={agent.error}
        messages={agent.messages}
        stream={agent.stream}
        callerName={profile?.full_name?.split(/\s+/)[0]}
        tips={agent.tips}
        onClose={agent.stop}
        onMute={agent.toggleMute}
        onEnd={agent.stop}
        onTip={agent.sendText}
        onPickJob={agent.pickJob}
      />
      <JobDrawer
        open={drawer.open}
        prefill={drawer.prefill}
        users={users.length ? users : profile ? [profile] : []}
        defaultAssignee={profile?.id || ''}
        onClose={() => setDrawer({ open: false, prefill: null })}
        onSaved={(saved) => {
          toast(`Job ${saved.job_number} created`);
          setDrawer({ open: false, prefill: null });
        }}
      />
    </div>
  );
}
