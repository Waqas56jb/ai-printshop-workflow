import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { StageTabs } from '../../components/jobs/StageTabs.jsx';
import { JobsToolbar } from '../../components/jobs/JobsToolbar.jsx';
import { JobsTable } from '../../components/jobs/JobsTable.jsx';
import { BulkBar } from '../../components/jobs/BulkBar.jsx';
import { JobDrawer } from '../../components/jobs/JobDrawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useJobs } from '../../hooks/useJobs.js';
import { useSocket } from '../../hooks/useSocket.js';
import { getStaffDashboard } from '../../services/dashboard.service.js';
import { assignJob, getCustomer, listJobs, listStages, listUsers, moveJobStage } from '../../services/jobs.service.js';

function paramsFromSearch(searchParams, profileId) {
  const assignedParam = searchParams.get('assigned');
  const mine = assignedParam !== 'all';
  return {
    stage: searchParams.get('stage') || '',
    priority: searchParams.get('priority') || '',
    assigned: mine ? profileId || '' : '',
    mine,
    due: searchParams.get('due') || '',
    search: searchParams.get('search') || searchParams.get('q') || '',
    customer: searchParams.get('customer') || '',
    page: searchParams.get('page') || '1',
  };
}

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const filters = useMemo(() => paramsFromSearch(searchParams, profile?.id), [searchParams, profile?.id]);
  const { jobs, total, page, limit, loading, refetch } = useJobs(filters);

  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState([]);
  const [drawerJob, setDrawerJob] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(location.pathname === '/jobs/new');
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    setDrawerOpen(location.pathname === '/jobs/new');
    if (location.pathname === '/jobs/new') setDrawerJob(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!filters.customer) {
      setCustomerName('');
      return;
    }
    getCustomer(filters.customer)
      .then((row) => setCustomerName(row.name || ''))
      .catch(() => setCustomerName('Customer'));
  }, [filters.customer]);

  useEffect(() => {
    Promise.all([listStages(), listUsers(), getStaffDashboard(), listJobs({ status: 'completed', page: 1, limit: 1 })])
      .then(([stageRows, userRows, dashboard, completed]) => {
        setStages(stageRows || []);
        setUsers((userRows || []).filter((user) => user.is_active !== false));
        const next = { active: dashboard.all_active?.length || 0, completed: completed.total || 0 };
        (dashboard.all_active || []).forEach((job) => {
          const stageId = job.stage?.id || job.stage_id;
          if (stageId) next[stageId] = (next[stageId] || 0) + 1;
        });
        setCounts(next);
      })
      .catch(() => {});
  }, [jobs]);

  const onLive = useCallback(() => {
    refetch();
  }, [refetch]);
  useSocket(onLive);

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
    setSelected([]);
  }

  function openNew() {
    navigate('/jobs/new');
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerJob(null);
    if (location.pathname === '/jobs/new') navigate('/jobs');
  }

  const filtered = Boolean(
    filters.stage || filters.priority || !filters.mine || filters.due || filters.search || filters.customer
  );
  const empty = !loading && jobs.length === 0;

  return (
    <main className="jobs-page">
      <StageTabs
        stages={stages}
        counts={counts}
        activeId={filters.stage}
        onChange={(value) => setParam('stage', value)}
      />
      <JobsToolbar
        search={filters.search}
        priority={filters.priority}
        mine={filters.mine}
        due={filters.due}
        onSearch={(value) => setParam('search', value)}
        onPriority={(value) => setParam('priority', value)}
        onMine={(value) => setParam('assigned', value ? '' : 'all')}
        onDue={(value) => setParam('due', value)}
        customerName={customerName}
        onClearCustomer={() => setParam('customer', '')}
        onNewJob={openNew}
      />

      {empty ? (
        <div className="panel">
          {filtered ? (
            <EmptyState
              message="No jobs match these filters"
              actionLabel="Clear filters"
              onAction={() => setSearchParams(new URLSearchParams())}
            />
          ) : (
            <EmptyState message="No jobs yet — create your first job" to="/jobs/new" />
          )}
        </div>
      ) : (
        <JobsTable
          jobs={jobs}
          loading={loading}
          selected={selected}
          onToggle={(id) =>
            setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
          }
          onToggleAll={() =>
            setSelected((current) => (current.length === jobs.length ? [] : jobs.map((job) => job.id)))
          }
          onRow={(id) => navigate(`/jobs/${id}`)}
          onMove={async (id, stageId) => {
            await moveJobStage(id, stageId);
            toast('Job moved');
            refetch();
          }}
          onEdit={(job) => {
            setDrawerJob(job);
            setDrawerOpen(true);
          }}
          stages={stages}
          page={page}
          total={total}
          limit={limit}
          onPage={(nextPage) => setParam('page', String(nextPage))}
        />
      )}

      <BulkBar
        count={selected.length}
        stages={stages}
        users={users}
        onClose={() => setSelected([])}
        onApply={async ({ stage_id, assigned_to }) => {
          await Promise.all(
            selected.map(async (id) => {
              if (stage_id) await moveJobStage(id, stage_id);
              if (assigned_to) await assignJob(id, assigned_to);
            })
          );
          toast(`${selected.length} jobs updated`);
          setSelected([]);
          refetch();
        }}
      />

      <JobDrawer
        open={drawerOpen}
        job={drawerJob}
        users={users}
        onClose={closeDrawer}
        onSaved={(saved, mode) => {
          toast(mode === 'created' ? `Job ${saved.job_number} created` : `Job ${saved.job_number} updated`);
          closeDrawer();
          refetch();
        }}
      />
    </main>
  );
}
