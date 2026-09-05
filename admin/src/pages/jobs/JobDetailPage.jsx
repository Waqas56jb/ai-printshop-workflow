import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArtworkGallery } from '../../components/jobs/detail/ArtworkGallery.jsx';
import { CustomerCard } from '../../components/jobs/detail/CustomerCard.jsx';
import { JobActivity } from '../../components/jobs/detail/JobActivity.jsx';
import { JobDetails } from '../../components/jobs/detail/JobDetails.jsx';
import { JobHeader } from '../../components/jobs/detail/JobHeader.jsx';
import { JobNotes } from '../../components/jobs/detail/JobNotes.jsx';
import { StageStepper } from '../../components/jobs/detail/StageStepper.jsx';
import { JobDrawer } from '../../components/jobs/JobDrawer.jsx';
import { useJob } from '../../hooks/useJob.js';
import { listStages, listUsers, moveJobStage } from '../../services/jobs.service.js';
import { useUiStore } from '../../store/uiStore.js';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { job, voiceCommands, loading, error, refetch } = useJob(id);
  const setPageTitle = useUiStore((state) => state.setPageTitle);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    Promise.all([listStages(), listUsers()])
      .then(([stageRows, userRows]) => {
        setStages(stageRows || []);
        setUsers((userRows || []).filter((user) => user.is_active !== false));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPageTitle(job?.job_number || null);
    return () => setPageTitle(null);
  }, [job?.job_number, setPageTitle]);

  async function handleMove(stageId) {
    try {
      await moveJobStage(job.id, stageId);
      toast('Stage updated');
      refetch();
    } catch (err) {
      toast(err.response?.data?.message || 'Could not move job');
    }
  }

  if (loading) {
    return (
      <main className="job-detail">
        <div className="skel" style={{ height: 28, width: 160 }} />
        <div className="skel" style={{ height: 72 }} />
        <div className="skel" style={{ height: 140 }} />
        <div className="grid">
          <div className="skel" style={{ minHeight: 280 }} />
          <div className="skel" style={{ minHeight: 280 }} />
        </div>
      </main>
    );
  }

  if (error && error !== 'not_found') {
    return (
      <main className="job-detail">
        <p className="login-error">{error}</p>
        <Link to="/jobs" style={{ color: 'var(--magenta)', fontWeight: 600 }}>
          Back to Jobs
        </Link>
      </main>
    );
  }

  if (error === 'not_found' || !job) {
    return (
      <main className="job-detail">
        <h1>Job not found</h1>
        <p style={{ color: 'var(--ink-2)' }}>This job may have been deleted or the link is wrong.</p>
        <Link to="/jobs" style={{ color: 'var(--magenta)', fontWeight: 600 }}>
          Back to Jobs
        </Link>
      </main>
    );
  }

  return (
    <main className="job-detail">
      <JobHeader
        job={job}
        onEdit={() => setDrawerOpen(true)}
        onChanged={refetch}
        onDeleted={() => navigate('/jobs')}
      />
      <StageStepper job={job} stages={stages} onMove={handleMove} />
      <div className="grid">
        <div className="col">
          <ArtworkGallery job={job} users={users} onChanged={refetch} />
          <JobNotes job={job} onChanged={refetch} />
        </div>
        <div className="col">
          <CustomerCard customer={job.customer} />
          <JobDetails job={job} users={users} onEdit={() => setDrawerOpen(true)} />
          <JobActivity job={job} users={users} voiceCommands={voiceCommands} />
        </div>
      </div>
      <JobDrawer
        open={drawerOpen}
        job={job}
        users={users}
        onClose={() => setDrawerOpen(false)}
        onSaved={(saved) => {
          toast(`Job ${saved.job_number} updated`);
          setDrawerOpen(false);
          refetch();
        }}
      />
    </main>
  );
}
