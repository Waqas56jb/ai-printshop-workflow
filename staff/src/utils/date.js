const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function startOfWeekIso() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}

export function endOfWeekIso() {
  const start = new Date(`${startOfWeekIso()}T00:00:00`);
  start.setDate(start.getDate() + 6);
  return start.toISOString().slice(0, 10);
}

export function nextWeekRange() {
  const start = new Date(`${startOfWeekIso()}T00:00:00`);
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function formatLongDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDueLabel(dueDate) {
  if (!dueDate) return '—';
  const due = startOfDay(dueDate);
  const today = startOfDay(new Date());
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return `${WEEKDAYS[due.getDay()].slice(0, 3)}, ${due.getDate()} ${MONTHS[due.getMonth()]}`;
}

export function dueTone(dueDate) {
  if (!dueDate) return '';
  const due = startOfDay(dueDate);
  const today = startOfDay(new Date());
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'over';
  if (diff === 0) return 'today';
  return '';
}

export function isOverdue(dueDate) {
  if (!dueDate) return false;
  return startOfDay(dueDate) < startOfDay(new Date());
}

export function isToday(dueDate) {
  if (!dueDate) return false;
  return startOfDay(dueDate).getTime() === startOfDay(new Date()).getTime();
}

export function formatRelative(value) {
  if (!value) return '';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatLastActivity(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (isSameDay(date)) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }
  return formatShortDate(date);
}

export function formatSinceDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatShortDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatDayTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (isSameDay(value)) return `Today, ${time}`;
  return `${formatShortDate(date)}, ${time}`;
}

export function formatDueDetail(dueDate) {
  if (!dueDate) return '—';
  const label = formatDueLabel(dueDate);
  const short = formatShortDate(`${dueDate}T00:00:00`);
  if (label === 'Today' || label === 'Yesterday' || label === 'Tomorrow') {
    return `${label}, ${short}`;
  }
  return `${label}`;
}

export function formatDuration(from) {
  if (!from) return '';
  const ms = Date.now() - new Date(from).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return mins <= 1 ? '1 minute' : `${mins} minutes`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

export function formatSinceTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isSameDay(value)) {
    return `Since ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }
  return formatShortDate(date);
}

export function formatJobAge(createdAt) {
  if (!createdAt) return '—';
  const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
  if (days === 0) return 'Today';
  return days === 1 ? '1 day' : `${days} days`;
}

export function isSameDay(value) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
