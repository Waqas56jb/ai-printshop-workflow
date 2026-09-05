import { supabase, unwrap } from '../../config/supabase.js';

function startOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function weekFromToday() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export async function getAdminDashboard() {
  const [
    jobsResult,
    customersResult,
    stages,
    overdueResult,
    completedWeekResult,
    activity,
    voiceCommands,
  ] = await Promise.all([
    supabase.from('jobs').select('id, status, stage_id', { count: 'exact' }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('stages').select('*').order('position', { ascending: true }),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .lt('due_date', todayIso()),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', startOfWeek()),
    supabase
      .from('job_stage_history')
      .select('id, created_at, source, changed_by_profile:profiles!changed_by(id, full_name, role)')
      .gte('created_at', startOfWeek())
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('voice_commands')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const jobs = unwrap(jobsResult, 'Failed to load jobs');
  const stageRows = unwrap(stages, 'Failed to load stages');

  const jobs_per_stage = (stageRows || []).map((stage) => ({
    stage_id: stage.id,
    name: stage.name,
    color: stage.color,
    count: (jobs || []).filter((job) => job.stage_id === stage.id).length,
  }));

  const staffMap = new Map();
  (unwrap(activity, 'Failed to load staff activity') || []).forEach((row) => {
    const key = row.changed_by_profile?.id || 'unknown';
    const current = staffMap.get(key) || {
      user: row.changed_by_profile,
      changes: 0,
    };
    current.changes += 1;
    staffMap.set(key, current);
  });

  return {
    totals: {
      jobs: jobsResult.count ?? (jobs || []).length,
      customers: customersResult.count ?? 0,
      active: (jobs || []).filter((job) => job.status === 'active').length,
      completed: (jobs || []).filter((job) => job.status === 'completed').length,
    },
    jobs_per_stage,
    overdue_count: overdueResult.count ?? 0,
    completed_this_week: completedWeekResult.count ?? 0,
    staff_activity: Array.from(staffMap.values()),
    recent_voice_commands: unwrap(voiceCommands, 'Failed to load voice commands') || [],
  };
}

function isPrintingStage(stage) {
  const slug = String(stage?.slug || '').toLowerCase();
  const name = String(stage?.name || '').toLowerCase().trim();
  return slug === 'printing' || name === 'printing';
}

function timeInStageLabel(from) {
  if (!from) return null;
  const mins = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 60000));
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function startOfDayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export async function getStaffDashboard(userId) {
  const today = todayIso();
  const [stagesResult, jobsResult, settingsResult] = await Promise.all([
    supabase.from('stages').select('*').order('position', { ascending: true }),
    supabase
      .from('jobs')
      .select(
        'id, job_number, title, quantity, priority, due_date, assigned_to, stage_id, status, created_at, customer:customers!customer_id(id, name), stage:stages!stage_id(id, name, slug, color, position, is_final)'
      )
      .eq('status', 'active')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('settings').select('key, value'),
  ]);

  const stages = unwrap(stagesResult, 'Failed to load stages') || [];
  const jobs = unwrap(jobsResult, 'Failed to load jobs') || [];
  const settingsRows = unwrap(settingsResult, 'Failed to load settings') || [];
  const settings = settingsRows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
  const requireArt = settings.require_artwork_before_printing === true;

  const ids = jobs.map((job) => job.id);
  const [artworks, history, doneWeek, voiceToday] = await Promise.all([
    ids.length
      ? unwrap(
          await supabase.from('job_artworks').select('job_id, is_approved').in('job_id', ids),
          'Failed to load artwork'
        )
      : [],
    ids.length
      ? unwrap(
          await supabase
            .from('job_stage_history')
            .select('job_id, created_at')
            .in('job_id', ids)
            .order('created_at', { ascending: false }),
          'Failed to load stage history'
        )
      : [],
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', 'completed')
      .gte('completed_at', startOfWeek()),
    unwrap(
      await supabase
        .from('voice_commands')
        .select('*, user:profiles!user_id(id, full_name), job:jobs!job_id(id, job_number)')
        .gte('created_at', startOfDayIso())
        .order('created_at', { ascending: false })
        .limit(10),
      'Failed to load voice today'
    ),
  ]);

  const artByJob = new Map();
  for (const row of artworks || []) {
    const current = artByJob.get(row.job_id) || { count: 0, approved: false };
    current.count += 1;
    if (row.is_approved) current.approved = true;
    artByJob.set(row.job_id, current);
  }

  const enteredAt = new Map();
  for (const row of history || []) {
    if (!enteredAt.has(row.job_id)) enteredAt.set(row.job_id, row.created_at);
  }

  function enrich(job) {
    const idx = stages.findIndex((stage) => stage.id === job.stage_id);
    const next = idx >= 0 ? stages[idx + 1] || null : null;
    const prev = idx > 0 ? stages[idx - 1] : null;
    const art = artByJob.get(job.id) || { count: 0, approved: false };
    const overdue = Boolean(job.due_date && job.due_date < today && !job.stage?.is_final);
    const artwork_blocked = Boolean(requireArt && next && isPrintingStage(next) && !art.approved);
    return {
      id: job.id,
      job_number: job.job_number,
      title: job.title,
      quantity: job.quantity,
      priority: job.priority,
      due_date: job.due_date,
      assigned_to: job.assigned_to,
      customer_name: job.customer?.name || null,
      customer: job.customer,
      stage: job.stage
        ? {
            id: job.stage.id,
            name: job.stage.name,
            color: job.stage.color,
            position: job.stage.position,
            slug: job.stage.slug,
            is_final: job.stage.is_final,
          }
        : null,
      next_stage: next ? { id: next.id, name: next.name, slug: next.slug, is_final: next.is_final } : null,
      prev_stage: prev ? { id: prev.id, name: prev.name } : null,
      artworks_count: art.count,
      approved_artwork: art.approved,
      artwork_blocked,
      time_in_stage: timeInStageLabel(enteredAt.get(job.id) || job.created_at),
      is_overdue: overdue,
    };
  }

  const enriched = jobs.map(enrich);
  const my_jobs = enriched.filter((job) => job.assigned_to === userId);
  const due_today = enriched.filter((job) => job.due_date === today);
  const overdue = enriched.filter((job) => job.is_overdue);

  return {
    my_jobs,
    due_today,
    all_active: enriched,
    counts: {
      overdue: overdue.length,
      due_today: due_today.length,
      done_by_me_week: doneWeek.count ?? 0,
      assigned_to_me: my_jobs.length,
    },
    voice_today: (voiceToday || []).map((row) => ({
      ...row,
      user_name: row.user?.full_name || null,
      job_number: row.job?.job_number || null,
    })),
  };
}
