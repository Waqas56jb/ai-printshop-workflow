import { supabase, unwrap } from '../../config/supabase.js';
import * as settingsService from '../settings/settings.service.js';

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

function daysBetween(dueDate) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function startOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diff);
  return date;
}

function initials(name = '') {
  const value = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return value || null;
}

function weekdayHint(dueDate) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  return due.toLocaleDateString('en-GB', { weekday: 'short' });
}

function sortBoardJobs(a, b) {
  if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
  if (a.is_due_today !== b.is_due_today) return a.is_due_today ? -1 : 1;
  const ad = a.due_date || '9999-12-31';
  const bd = b.due_date || '9999-12-31';
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4);
}

function isDeliveredStage(stage) {
  return Boolean(stage?.is_final) || stage?.slug === 'delivered';
}

function includeJobOnBoard(job, stage, hideHours) {
  if (job.status === 'active') return true;
  if (job.status !== 'completed' || !isDeliveredStage(stage)) return false;
  if (!hideHours || hideHours <= 0) return true;
  if (!job.completed_at) return false;
  return new Date(job.completed_at).getTime() >= Date.now() - hideHours * 3600000;
}

function mapBoardJob(job, stage, art = { count: 0, approved: false }) {
  const days_left = daysBetween(job.due_date);
  const is_overdue = days_left !== null && days_left < 0 && !stage.is_final;
  const is_due_today = days_left === 0 && !stage.is_final;
  return {
    id: job.id,
    job_number: job.job_number,
    customer_name: job.customer?.name || null,
    title: job.title,
    quantity: job.quantity,
    priority: job.priority,
    due_date: job.due_date,
    due_label_hint: weekdayHint(job.due_date),
    is_overdue,
    is_due_today,
    assigned_initials: initials(job.assignee?.full_name),
    artworks_count: art.count,
    has_approved_artwork: art.approved,
    updated_at: job.updated_at,
  };
}

export async function getBoard() {
  const stages = unwrap(
    await supabase.from('stages').select('*').order('position', { ascending: true }),
    'Failed to load stages'
  );

  const jobs = unwrap(
    await supabase
      .from('jobs')
      .select(
        'id, job_number, title, quantity, due_date, priority, stage_id, customer:customers!customer_id(name)'
      )
      .eq('status', 'active'),
    'Failed to load board jobs'
  );

  return (stages || [])
    .filter((stage) => stage.show_on_board !== false)
    .map((stage) => ({
      ...stage,
      jobs: (jobs || [])
        .filter((job) => job.stage_id === stage.id)
        .map((job) => {
          const days_left = daysBetween(job.due_date);
          return {
            id: job.id,
            job_number: job.job_number,
            customer_name: job.customer?.name || null,
            title: job.title,
            quantity: job.quantity,
            due_date: job.due_date,
            priority: job.priority,
            is_overdue: days_left !== null && days_left < 0 && !stage.is_final,
            days_left,
          };
        }),
    }));
}

export async function getBoardDisplay() {
  const settings = await settingsService.getSettings();
  const hideHours = Number(settings.board_hide_delivered_after ?? 2);

  const stages = unwrap(
    await supabase.from('stages').select('*').order('position', { ascending: true }),
    'Failed to load stages'
  );

  const jobs = unwrap(
    await supabase
      .from('jobs')
      .select(
        `
        id, job_number, title, quantity, due_date, priority, stage_id, status, completed_at, updated_at,
        customer:customers!customer_id(name),
        assignee:profiles!assigned_to(full_name)
      `
      )
      .in('status', ['active', 'completed']),
    'Failed to load board jobs'
  );

  const jobIds = (jobs || []).map((job) => job.id);
  const artworks = jobIds.length
    ? unwrap(
        await supabase.from('job_artworks').select('job_id, is_approved').in('job_id', jobIds),
        'Failed to load artwork'
      )
    : [];

  const artByJob = (artworks || []).reduce((acc, row) => {
    const current = acc.get(row.job_id) || { count: 0, approved: false };
    current.count += 1;
    if (row.is_approved) current.approved = true;
    acc.set(row.job_id, current);
    return acc;
  }, new Map());

  const visibleStages = (stages || []).filter((stage) => stage.show_on_board !== false);
  const columns = visibleStages.map((stage) => {
    const columnJobs = (jobs || [])
      .filter((job) => job.stage_id === stage.id && includeJobOnBoard(job, stage, hideHours))
      .map((job) => mapBoardJob(job, stage, artByJob.get(job.id)))
      .sort(sortBoardJobs);
    return {
      id: stage.id,
      name: stage.name,
      color: stage.color,
      position: stage.position,
      jobs: columnJobs,
    };
  });

  const active = (jobs || []).filter((job) => job.status === 'active');
  const stageById = new Map((stages || []).map((stage) => [stage.id, stage]));
  const inProgress = active.filter((job) => !stageById.get(job.stage_id)?.is_final);
  const weekStart = startOfWeek();

  const lastVoiceRow = unwrap(
    await supabase
      .from('voice_commands')
      .select(
        'transcript, intent, action, created_at, user:profiles!user_id(full_name), job:jobs!job_id(job_number)'
      )
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'Failed to load last voice command'
  );

  let last_voice = null;
  if (lastVoiceRow) {
    const stageName = lastVoiceRow.intent?.stage;
    const jobNumber = lastVoiceRow.job?.job_number;
    last_voice = {
      transcript: lastVoiceRow.transcript,
      summary:
        lastVoiceRow.intent?.reply ||
        (jobNumber && stageName ? `${jobNumber} → ${stageName}` : lastVoiceRow.action || ''),
      user_name: lastVoiceRow.user?.full_name || null,
      created_at: lastVoiceRow.created_at,
    };
  }

  return {
    shop: {
      name: settings.business_name || 'Print Shop',
      logo_url: settings.business_logo_url || null,
    },
    settings: {
      theme: settings.board_theme || 'dark',
      card_size: settings.board_card_size || 'normal',
      show_customer: settings.board_show_customer !== false,
      show_due: settings.board_show_due !== false,
      overdue_highlight: settings.board_overdue_highlight !== false,
      refresh_seconds: Number(settings.board_refresh_seconds) || 30,
      hide_delivered_after: Number(settings.board_hide_delivered_after ?? 2),
    },
    summary: {
      in_progress: inProgress.length,
      due_today: inProgress.filter((job) => daysBetween(job.due_date) === 0).length,
      overdue: inProgress.filter((job) => {
        const days = daysBetween(job.due_date);
        return days !== null && days < 0;
      }).length,
      delivered_this_week: (jobs || []).filter(
        (job) => job.status === 'completed' && job.completed_at && new Date(job.completed_at) >= weekStart
      ).length,
    },
    stages: columns,
    last_voice,
  };
}
