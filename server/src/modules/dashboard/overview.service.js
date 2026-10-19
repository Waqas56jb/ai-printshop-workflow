import { supabase, unwrap } from '../../config/supabase.js';

// Home dashboard for the panel: KPIs, jobs per stage, 8 weeks of new vs finished,
// top customers, what's due soon and the latest moves. Dates are counted in the
// shop's own time zone (sent by the browser), not the server's.

const WEEKS = 8;
const DAY_MS = 86400000;

function safeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return 'UTC';
  }
}

// 'YYYY-MM-DD' of an instant in the shop's time zone.
function localDay(value, tz) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(value)
  );
}

function addDays(day, n) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

// Monday of the week that contains `day`.
function weekStart(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const back = (date.getUTCDay() + 6) % 7;
  return addDays(day, -back);
}

export async function getOverview({ tz = 'UTC' } = {}) {
  const zone = safeZone(tz);
  const today = localDay(new Date(), zone);
  const thisWeek = weekStart(today);
  const monthStart = `${today.slice(0, 8)}01`;
  const firstWeek = addDays(thisWeek, -7 * (WEEKS - 1));

  const [jobsRes, stagesRes, customersRes, artworksRes, shopFilesRes, voiceRes, historyRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, job_number, title, status, stage_id, due_date, created_at, completed_at, customer_id, customer:customers!customer_id(name)'),
    supabase.from('stages').select('id, name, color, position').order('position', { ascending: true }),
    supabase.from('customers').select('id, name, created_at'),
    supabase.from('job_artworks').select('id', { count: 'exact', head: true }),
    supabase.from('shop_files').select('id', { count: 'exact', head: true }),
    supabase
      .from('voice_commands')
      .select('status, created_at')
      .gte('created_at', new Date(Date.now() - 2 * DAY_MS).toISOString()),
    supabase
      .from('job_stage_history')
      .select(
        'created_at, source, from_stage_id, to_stage:stages!to_stage_id(name, color), job:jobs!job_id(job_number, title), who:profiles!changed_by(full_name)'
      )
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const jobs = unwrap(jobsRes, 'Failed to load jobs') || [];
  const stages = unwrap(stagesRes, 'Failed to load stages') || [];
  const customers = unwrap(customersRes, 'Failed to load customers') || [];
  const voice = (unwrap(voiceRes, 'Failed to load voice commands') || []).filter(
    (row) => localDay(row.created_at, zone) === today
  );

  const active = jobs.filter((job) => job.status === 'active');
  const completed = jobs.filter((job) => job.status === 'completed');
  const doneOn = (job) => localDay(job.completed_at, zone);
  const voiceDecided = voice.filter((row) => row.status === 'executed' || row.status === 'failed');

  const kpis = {
    active: active.length,
    due_today: active.filter((job) => job.due_date && job.due_date.slice(0, 10) === today).length,
    late: active.filter((job) => job.due_date && job.due_date.slice(0, 10) < today).length,
    done_this_week: completed.filter((job) => doneOn(job) && doneOn(job) >= thisWeek).length,
    done_this_month: completed.filter((job) => doneOn(job) && doneOn(job) >= monthStart).length,
    done_total: completed.length,
    new_this_month: jobs.filter((job) => localDay(job.created_at, zone) >= monthStart).length,
    jobs_total: jobs.length,
    customers: customers.length,
    new_customers_this_month: customers.filter((row) => localDay(row.created_at, zone) >= monthStart).length,
    files: (artworksRes.count || 0) + (shopFilesRes.count || 0),
    voice_today: voice.length,
    voice_understood: voiceDecided.length
      ? Math.round((voiceDecided.filter((row) => row.status === 'executed').length / voiceDecided.length) * 100)
      : null,
  };

  const byStage = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    color: stage.color,
    count: active.filter((job) => job.stage_id === stage.id).length,
  }));

  const weeks = Array.from({ length: WEEKS }, (_, index) => {
    const start = addDays(firstWeek, index * 7);
    const end = addDays(start, 7);
    const inWeek = (day) => day && day >= start && day < end;
    return {
      week_start: start,
      created: jobs.filter((job) => inWeek(localDay(job.created_at, zone))).length,
      completed: completed.filter((job) => inWeek(doneOn(job))).length,
    };
  });

  const perCustomer = new Map();
  for (const job of jobs) {
    if (!job.customer_id) continue;
    const row = perCustomer.get(job.customer_id) || { id: job.customer_id, name: job.customer?.name || '—', total: 0, active: 0 };
    row.total += 1;
    if (job.status === 'active') row.active += 1;
    perCustomer.set(job.customer_id, row);
  }
  const topCustomers = [...perCustomer.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, 5);

  const soonLimit = addDays(today, 7);
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const dueSoon = active
    .filter((job) => job.due_date && job.due_date.slice(0, 10) <= soonLimit)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8)
    .map((job) => ({
      id: job.id,
      job_number: job.job_number,
      title: job.title,
      customer_name: job.customer?.name || null,
      due_date: job.due_date.slice(0, 10),
      stage_name: stageById.get(job.stage_id)?.name || null,
      stage_color: stageById.get(job.stage_id)?.color || null,
    }));

  const recent = (unwrap(historyRes, 'Failed to load recent moves') || [])
    .filter((row) => row.job)
    .map((row) => ({
      at: row.created_at,
      created: !row.from_stage_id,
      job_number: row.job.job_number,
      title: row.job.title,
      stage_name: row.to_stage?.name || null,
      stage_color: row.to_stage?.color || null,
      by: row.source === 'voice' ? 'voice' : row.who?.full_name || null,
    }));

  return { today, tz: zone, kpis, by_stage: byStage, weeks, top_customers: topCustomers, due_soon: dueSoon, recent };
}
