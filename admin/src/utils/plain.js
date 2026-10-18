// Plain-words helpers for the simple panel. The Jobs tab shows one column per
// real stage (same order and colors as the TV board) plus a "Done" column.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DONE = 'done';

export function sortStages(stages = []) {
  return [...stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

// Which column a job sits in: its stage, or "done" once completed.
export function columnKey(job) {
  return job.status === 'completed' ? DONE : job.stage_id;
}

export function nextStage(stages, stageId) {
  const index = stages.findIndex((stage) => stage.id === stageId);
  return index >= 0 && index < stages.length - 1 ? stages[index + 1] : null;
}

export function isLastStage(stages, stageId) {
  return stages.length > 0 && stages[stages.length - 1].id === stageId;
}

function startOfDay(value) {
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysFromToday(value) {
  return Math.round((startOfDay(value).getTime() - startOfDay(new Date()).getTime()) / 86400000);
}

function dayWords(value) {
  const diff = daysFromToday(value);
  const date = startOfDay(value);
  if (diff === 0) return 'today';
  if (diff === -1) return 'yesterday';
  if (diff === 1) return 'tomorrow';
  if (Math.abs(diff) < 7) return WEEKDAYS[date.getDay()];
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function clockTime(value) {
  const date = new Date(value);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes}${hours < 12 ? 'am' : 'pm'}`;
}

export function whenWords(value) {
  if (!value) return '';
  const day = dayWords(value);
  return day === 'today' ? clockTime(value) : `${day[0].toUpperCase()}${day.slice(1)}, ${clockTime(value)}`;
}

// "Due today", "Late — was due Friday", "Done yesterday".
export function dueLine(job) {
  if (job.status === 'completed') {
    const at = job.completed_at || job.updated_at;
    return { text: at ? `Done ${dayWords(at)}` : 'Done', tone: '' };
  }
  if (/^ready$/i.test(String(job.stage?.name || '').trim())) return { text: 'Waiting for pickup', tone: '' };
  if (!job.due_date) return { text: 'No due date', tone: '' };
  const diff = daysFromToday(job.due_date);
  if (diff < 0) return { text: `Late — was due ${dayWords(job.due_date)}`, tone: 'late' };
  if (diff === 0) return { text: 'Due today', tone: 'today' };
  return { text: `Due ${dayWords(job.due_date)}`, tone: '' };
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

// "Sarah's 50 T-Shirts", or just the title when there is no customer.
export function jobPhrase(job) {
  const who = firstName(job.customer?.name);
  const title = job.title || job.job_number || 'job';
  return who ? `${who}'s ${title}` : title;
}

// Toast after a move: "Sarah's 50 T-Shirts → Printing", or "… — PAID. All done ✓".
export function movedToast(job, stage, completed) {
  return completed ? `${jobPhrase(job)} — ${stage.name}. All done ✓` : `${jobPhrase(job)} → ${stage.name}`;
}

export function doneToast(job) {
  return `${jobPhrase(job)} — all done ✓`;
}

export function errorWords(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.message || error?.message || fallback;
}

// One plain list of what happened to a job: stage moves, files and notes.
export function historyLines(job, stages = []) {
  const last = stages[stages.length - 1];
  const lines = [];
  const rows = job.history || [];
  // The oldest row is the job being made (later rows can lose their "from"
  // stage when that stage is removed).
  const first = rows.reduce(
    (oldest, row) => (!oldest || new Date(row.created_at) < new Date(oldest.created_at) ? row : oldest),
    null
  );
  for (const row of rows) {
    const by =
      row.source === 'voice'
        ? 'by voice'
        : row.changed_by_profile?.full_name
          ? `by ${firstName(row.changed_by_profile.full_name)}`
          : '';
    let what;
    if (row === first && !row.from_stage_id) what = 'Job created';
    else what = `Moved to ${row.to_stage?.name || 'another stage'}${row.to_stage_id === last?.id ? ' — done' : ''}`;
    lines.push({ at: row.created_at, text: [what, by].filter(Boolean).join(' ') });
  }
  for (const file of job.artworks || []) {
    lines.push({ at: file.created_at, text: `File added: ${file.file_name}` });
  }
  for (const note of Array.isArray(job.notes) ? job.notes : []) {
    lines.push({ at: note.created_at, text: `Note: ${note.content}` });
  }
  return lines
    .filter((line) => line.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function isImageFile(file) {
  if (String(file?.file_type || '').toLowerCase().startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(file?.file_name || file?.file_url || '');
}

export function fileExt(file) {
  const match = String(file?.file_name || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toUpperCase() : 'FILE';
}
