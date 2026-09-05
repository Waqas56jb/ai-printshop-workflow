import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { JobDrawer } from '../components/jobs/JobDrawer.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { listUsers } from '../services/jobs.service.js';
import { TopNav } from './TopNav.jsx';

export function AppLayout() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [drawer, setDrawer] = useState({ open: false, prefill: null });

  useEffect(() => {
    listUsers()
      .then((rows) => setUsers((rows || []).filter((user) => user.is_active !== false && user.role !== 'worker')))
      .catch(() => {});
  }, []);

  const openJob = useCallback((prefill = null) => {
    setDrawer({ open: true, prefill });
  }, []);

  return (
    <div className="staff-app">
      <TopNav onNewJob={() => openJob(null)} />
      <Outlet context={{ openJob }} />
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
