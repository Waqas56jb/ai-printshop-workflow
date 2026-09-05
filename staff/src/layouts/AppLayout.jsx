import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { JobDrawer } from '../components/jobs/JobDrawer.jsx';
import { VoiceAgentPanel } from '../components/voice-agent/VoiceAgentPanel.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useRealtimeAgent } from '../hooks/useRealtimeAgent.js';
import { listUsers } from '../services/jobs.service.js';
import { getRealtimeConfig } from '../services/realtime.service.js';
import { useVoiceAgentStore } from '../store/voiceAgentStore.js';
import { REALTIME_ENABLED } from '../config.js';
import { TopNav } from './TopNav.jsx';

export function AppLayout() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [drawer, setDrawer] = useState({ open: false, prefill: null });
  const agent = useRealtimeAgent();
  const setEnabled = useVoiceAgentStore((state) => state.setEnabled);

  useEffect(() => {
    listUsers()
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

  const openJob = useCallback((prefill = null) => {
    setDrawer({ open: true, prefill });
  }, []);

  return (
    <div className="staff-app">
      <TopNav
        onNewJob={() => openJob(null)}
        voice={{
          enabled: REALTIME_ENABLED && agent.enabled,
          status: agent.status,
          onToggle: agent.toggle,
        }}
      />
      <Outlet context={{ openJob }} />
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
        onClose={() => setDrawer({ open: false, prefill: null })}
        onSaved={(saved) => {
          toast(`Job ${saved.job_number} created`);
          setDrawer({ open: false, prefill: null });
        }}
      />
    </div>
  );
}
