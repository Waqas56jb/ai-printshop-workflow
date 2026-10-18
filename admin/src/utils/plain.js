// Plain-words helpers for the simple panel: the 4-column view over the real
// stages, due lines, history lines and toast messages.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const COLUMNS = [
  { key: 'new', label: 'New' },
  { key: 'working', label: 'Working' },
  { key: 'ready', label: 'Ready' },
  { key: 'done', label: 'Done' },
];

// New = default stage, Ready = the stage named "Ready" (or second-to-last),
// Done = completed jobs, Working = every other stage collapsed together.
export function stageView(stages = []) {
  const sorted = [...stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const newStage = sorted.find((stage) => stage.is_default) || sorted[0] || null;
  const final = sorted.find((stage) => stage.is_final) || sorted[sorted.length - 1] || null;
  const ready =
    sorted.find((stage) => String(stage.name || '').trim().toLowerCase() === 'ready') ||
    sorted[sorted.length - 2] ||
    null;
  // "Start work" moves a new job to the first stage after New.
  const start =
    sorted.find(
      (stage) =>
        stage.id !== newStage?.id &&
        stage.id !== ready?.id &&
        !stage.is_final &&
        (stage.position ?? 0) > (newStage?.position ?? 0)
    ) || ready;
  return { newStage, ready, start, final };
}

export function columnOf(job, view) {
  if (job.status === 'completed') return 'done';
  if (job.stage_id === view.newStage?.id) return 'new';
  if (job.stage_id === view.ready?.id) return 'ready';
  return 'working';
}

function startOfDay(value) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
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

// "Due today", "Late — was due Friday", "Waiting for pickup", "Done yesterday".
export function dueLine(job, column) {
  if (column === 'done') {
    const at = job.completed_at || job.updated_at;
    return { text: at ? `Done ${dayWords(at)}` : 'Done', tone: '' };
  }
  if (column === 'ready') return { text: 'Waiting for pickup', tone: 'ready' };
  if (!job.due_date) return { text: 'No due date', tone: '' };
  const diff = daysFromToday(job.due_date);
  if (diff < 0) return { text: `Late — was due ${dayWords(job.due_date)}`, tone: 'late' };
  if (diff === 0) return { text: 'Due today', tone: 'today' };
  return { text: `Due ${dayWords(job.due_date)}`, tone: '' };
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

// "Sarah's 50 T-Shirts" / "the Hoodie" when there is no customer.
export function jobPhrase(job) {
  const who = firstName(job.customer?.name);
  const title = job.title || job.job_number || 'job';
  return who ? `${who}'s ${title}` : title;
}

function isPlural(job) {
  return /s$/i.test(String(job.title || '').trim()) || Number(job.quantity) > 1;
}

export function readyToast(job) {
  return `${jobPhrase(job)} ${isPlural(job) ? 'are' : 'is'} Ready`;
}

export function pickedUpToast(job) {
  return `${jobPhrase(job)} ${isPlural(job) ? 'were' : 'was'} picked up — all done`;
}

export function startedToast(job) {
  return `Started work on ${jobPhrase(job)}`;
}

export function errorWords(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.message || error?.message || fallback;
}

// One plain list of what happened to a job: stage moves, files and notes.
export function historyLines(job, view) {
  const lines = [];
  for (const row of job.history || []) {
    const by =
      row.source === 'voice'
        ? 'by voice'
        : row.changed_by_profile?.full_name
          ? `by ${firstName(row.changed_by_profile.full_name)}`
          : '';
    let what;
    if (!row.from_stage_id) what = 'Job created';
    else if (row.to_stage_id === view.final?.id) what = 'Picked up';
    else if (row.to_stage_id === view.newStage?.id) what = 'Moved back to New';
    else if (row.to_stage_id === view.ready?.id) what = 'Moved to Ready';
    else what = `Moved to ${row.to_stage?.name || 'Working'}`;
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
