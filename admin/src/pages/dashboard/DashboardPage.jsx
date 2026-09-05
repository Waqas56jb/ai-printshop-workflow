import { useCallback } from 'react';
import { ProductionLine } from '../../components/dashboard/ProductionLine.jsx';
import { DueJobsTable } from '../../components/dashboard/DueJobsTable.jsx';
import { VoiceFeed } from '../../components/dashboard/VoiceFeed.jsx';
import { StaffWorkload } from '../../components/dashboard/StaffWorkload.jsx';
import { KpiCard } from '../../components/dashboard/KpiCard.jsx';
import { MetricCard } from '../../components/ui/MetricCard.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useDashboard } from '../../hooks/useDashboard.js';
import { useSocket } from '../../hooks/useSocket.js';
import { confirmVoice, rejectVoice } from '../../services/dashboard.service.js';

export default function DashboardPage() {
  const { data, loading, error, refetch } = useDashboard();
  const onLive = useCallback(() => {
    refetch();
  }, [refetch]);
  useSocket(onLive);

  async function handleConfirm(id) {
    await confirmVoice(id);
    refetch();
  }

  async function handleReject(id) {
    await rejectVoice(id);
    refetch();
  }

  if (loading && !data) {
    return (
      <main className="content">
        <div className="skel" style={{ height: 160 }} />
        <div className="metrics">
          <div className="skel" />
          <div className="skel" />
          <div className="skel" />
          <div className="skel" />
        </div>
        <Spinner />
      </main>
    );
  }

  if (error) {
    return (
      <main className="content">
        <div className="login-error">{error}</div>
      </main>
    );
  }

  const totals = data.totals || {};
  const noJobs = (totals.jobs || 0) === 0;
  const overdueJob = data.overdue[0];
  const pendingCount = data.pendingVoice.length;

  return (
    <main className="content">
      <ProductionLine
        stages={data.stages}
        overdueByStage={data.overdueByStage}
        activeCount={totals.active || 0}
        completedThisWeek={data.completedThisWeek}
      />

      <section className="metrics">
        <MetricCard
          label="Due today"
          value={data.dueToday.length}
          detail={data.overdue.length ? `${data.overdue.length} already late` : 'On track'}
          tone={data.overdue.length ? 'warn' : 'up'}
        />
        <MetricCard
          label="Overdue"
          value={data.overdue.length}
          detail={
            overdueJob
              ? `${overdueJob.job_number} · ${overdueJob.stage?.name || 'Active'} stage`
              : 'None overdue'
          }
        />
        <MetricCard
          label="Completed this week"
          value={data.completedThisWeek}
          detail={`${totals.active || 0} still active`}
          tone="up"
        />
        <MetricCard
          label="Voice commands today"
          value={data.voiceToday.length}
          detail={pendingCount ? `${pendingCount} need confirmation` : 'All clear'}
        />
      </section>

      <section className="grid-2">
        <DueJobsTable jobs={data.dueSoon} empty={noJobs} />
        <VoiceFeed commands={data.voiceCommands} onConfirm={handleConfirm} onReject={handleReject} />
      </section>

      <section className="grid-3">
        <StaffWorkload staff={data.staff} />
        <KpiCard
          value={`${data.completedThisWeek}`}
          subtitle="Jobs completed this week"
          bar={Math.min(100, data.completedThisWeek * 12)}
          footnote={`${totals.active || 0} still on the floor`}
        />
        <KpiCard
          value={`${data.understoodPct}%`}
          subtitle="Voice commands understood without confirmation"
          bar={data.understoodPct}
          barColor="var(--magenta)"
          footnote={`${data.voiceToday.length} today · ${pendingCount} pending`}
        />
      </section>
    </main>
  );
}
