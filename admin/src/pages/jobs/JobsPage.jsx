import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { StageTabs } from '../../components/jobs/StageTabs.jsx';
import { JobsToolbar } from '../../components/jobs/JobsToolbar.jsx';
import { JobsTable } from '../../components/jobs/JobsTable.jsx';
import { BulkBar } from '../../components/jobs/BulkBar.jsx';
import { JobDrawer } from '../../components/jobs/JobDrawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { useJobs } from '../../hooks/useJobs.js';
import { useSocket } from '../../hooks/useSocket.js';
import { getAdminDashboard } from '../../services/dashboard.service.js';
import { assignJob, deleteJob, getCustomer, listStages, listUsers, moveJobStage } from '../../services/jobs.service.js';

function paramsFromSearch(searchParams) {
  return {
    stage: searchParams.get('stage') || '',
    priority: searchParams.get('priority') || '',
    assigned: searchParams.get('assigned') || '',
    due: searchParams.get('due') || '',
    search: searchParams.get('search') || '',
    customer: searchParams.get('customer') || '',
    page: searchParams.get('page') || '1',
  };
}

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const filters = useMemo(() => paramsFromSearch(searchParams), [searchParams]);
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
    Promise.all([listStages(), listUsers(), getAdminDashboard()])
      .then(([stageRows, userRows, dashboard]) => {
        setStages(stageRows || []);
        setUsers((userRows || []).filter((user) => user.is_active !== false));
        const next = { active: dashboard.totals?.active || 0, completed: dashboard.totals?.completed || 0 };
        (dashboard.jobs_per_stage || []).forEach((row) => {
          next[row.stage_id] = row.count;
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

  function exportCsv() {
    const header = ['Job', 'Title', 'Customer', 'Stage', 'Qty', 'Due', 'Assigned', 'Priority'];
    const rows = jobs.map((job) => [
      job.job_number,
      job.title,
      job.customer?.name || '',
      job.stage?.name || '',
      job.quantity,
      job.due_date || '',
      job.assignee?.full_name || '',
      job.priority,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jobs.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const filtered = Boolean(
    filters.stage || filters.priority || filters.assigned || filters.due || filters.search || filters.customer
  );
  const empty = !loading && jobs.length === 0;

  return (
    <main className="content jobs-page">
      <StageTabs
        stages={stages}
        counts={counts}
        activeId={filters.stage}
        onChange={(value) => setParam('stage', value)}
      />
      <JobsToolbar
        search={filters.search}
        priority={filters.priority}
        assigned={filters.assigned}
        due={filters.due}
        users={users}
        onSearch={(value) => setParam('search', value)}
        onPriority={(value) => setParam('priority', value)}
        onAssigned={(value) => setParam('assigned', value)}
        onDue={(value) => setParam('due', value)}
        customerName={customerName}
        onClearCustomer={() => setParam('customer', '')}
        onExport={exportCsv}
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
        onDelete={async () => {
          await Promise.all(selected.map((id) => deleteJob(id)));
          toast(`${selected.length} jobs deleted`);
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
