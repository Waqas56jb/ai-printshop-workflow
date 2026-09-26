import * as jobsService from '../jobs/jobs.service.js';
import * as stagesService from '../stages/stages.service.js';
import * as settingsService from '../settings/settings.service.js';
import { generateSpeech } from './tts.service.js';
import {
  emitBoardFocus,
  emitBoardDetails,
  emitBoardArtwork,
  emitBoardNavigate,
  emitBoardConfirm,
  emitBoardSpeak,
  emitBoardTicker,
  emitBoardListening,
} from '../../sockets/events.js';
import { getBoardSession, updateBoardSession, clearBoardSession } from '../../sockets/boardSession.js';
import { logger } from '../../utils/logger.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function initials(name = '') {
  const value = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return value || null;
}

function dueLabel(dueDate) {
  if (!dueDate) return 'No due date';
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff === -1) return 'Overdue by 1 day';
  if (diff < -1) return `Overdue by ${Math.abs(diff)} days`;
  if (diff > 1 && diff <= 6) return `Due ${WEEKDAYS[due.getDay()]}`;
  return `Due ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function payloadFromJob(job, stages) {
  const idx = stages.findIndex((stage) => stage.id === job.stage_id);
  const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;
  const prev = idx > 0 ? stages[idx - 1] : null;
  return {
    job_id: job.id,
    job_number: job.job_number,
    customer_name: job.customer?.name || '',
    title: job.title,
    stage_id: job.stage_id,
    stage_name: job.stage?.name || '',
    stage_color: job.stage?.color || '#6366f1',
    quantity: job.quantity,
    due_label: dueLabel(job.due_date),
    priority: job.priority,
    assigned_initials: initials(job.assignee?.full_name),
    artworks: (job.artworks || []).map((art) => ({
      url: art.file_url,
      name: art.file_name,
      is_approved: Boolean(art.is_approved),
    })),
    details: {
      product_type: job.product_type,
      print_type: job.print_type,
      size_details: job.size_details,
      price: job.price,
      created_at: job.created_at,
    },
    next_stage: next ? { id: next.id, name: next.name } : null,
    prev_stage: prev ? { id: prev.id, name: prev.name } : null,
  };
}

// Stage order rarely changes; a short cache saves a round trip per spotlight.
let stagesCache = { at: 0, promise: null };

function cachedStages() {
  if (!stagesCache.promise || Date.now() - stagesCache.at > 15_000) {
    const promise = stagesService.listStages();
    stagesCache = { at: Date.now(), promise };
    promise.catch(() => {
      if (stagesCache.promise === promise) stagesCache = { at: 0, promise: null };
    });
  }
  return stagesCache.promise;
}

async function ensureFocus(jobId) {
  const [job, stages] = await Promise.all([jobsService.getJob(jobId), cachedStages()]);
  const payload = payloadFromJob(job, stages);
  clearPendingChoice();
  updateBoardSession({ focused_job_id: jobId });
  emitBoardFocus(payload);
  logger.info(`board:focus ${JSON.stringify({ job_id: payload.job_id, job_number: payload.job_number, customer_name: payload.customer_name, stage_name: payload.stage_name })}`);
  return { job, payload };
}

export function getFocusedJobId() {
  return getBoardSession().focused_job_id || null;
}

export async function focusJob(jobId) {
  if (!jobId) return null;
  const { payload } = await ensureFocus(jobId);
  updateBoardSession({ artwork_index: 0 });
  logger.info(`board:focus job=${payload.job_number} customer=${payload.customer_name}`);
  return payload;
}

export async function showDetails(jobId) {
  const id = jobId || getFocusedJobId();
  if (!id) return;
  await ensureFocus(id);
  emitBoardDetails({ job_id: id });
  logger.info(`board:details job_id=${id}`);
}

export async function showArtwork(jobId, index = 0) {
  const id = jobId || getFocusedJobId();
  if (!id) return;
  const { job } = await ensureFocus(id);
  const artworks = job.artworks || [];
  const total = artworks.length;
  const safeIndex = total ? ((index % total) + total) % total : 0;
  updateBoardSession({ artwork_index: safeIndex });
  const art = artworks[safeIndex];
  const payload = {
    job_id: id,
    index: safeIndex,
    url: art?.file_url || null,
    name: art?.file_name || null,
    total,
    is_approved: Boolean(art?.is_approved),
  };
  emitBoardArtwork(payload);
  logger.info(`board:artwork ${JSON.stringify(payload)}`);
}

export async function stepArtwork(jobId, direction) {
  const id = jobId || getFocusedJobId();
  if (!id) return;
  const current = getBoardSession().artwork_index || 0;
  const next = direction === 'next' ? current + 1 : current - 1;
  await showArtwork(id, next);
}

export function navigate(action, extra = {}) {
  emitBoardNavigate({ action, ...extra });
  logger.info(`board:navigate action=${action}${extra.filter ? ` filter=${extra.filter}` : ''}`);
  if (action === 'back') {
    clearBoardSession();
    clearPendingChoice();
  }
  if (action === 'filter') updateBoardSession({ board_filter: extra.filter || 'all' });
}

// When the TV asks "Which one — …?", the spoken answer ("the hoodie", "the
// second one", "J-1042") is matched against those candidates first.
const CHOICE_TTL_MS = 30_000;
let pendingChoice = null;
const ORDINALS = [
  /\b(first|1st|one|top)\b/,
  /\b(second|2nd|two)\b/,
  /\b(third|3rd|three)\b/,
  /\b(fourth|4th|four)\b/,
];

export function confirmCandidates(candidates, prompt) {
  const payload = {
    candidates: (candidates || []).map((job) => ({
      job_id: job.id,
      job_number: job.job_number,
      customer_name: job.customer_name,
      title: job.title,
    })),
    prompt,
  };
  pendingChoice = { candidates: payload.candidates, at: Date.now() };
  emitBoardConfirm(payload);
  logger.info(`board:confirm ${JSON.stringify(payload)}`);
}

export function resolvePendingChoice(text) {
  if (!pendingChoice || Date.now() - pendingChoice.at > CHOICE_TTL_MS) return null;
  const heard = tokens(text);
  if (!heard.length) return null;
  const spoken = heard.join(' ');
  const { candidates } = pendingChoice;

  // Words that only name the shared customer ("Sarah Khan") don't tell candidates apart.
  const shared = new Set(
    candidates
      .map((candidate) => new Set(tokens(`${candidate.title} ${candidate.customer_name}`)))
      .reduce((acc, words) => [...acc].filter((word) => words.has(word)))
  );
  const scored = candidates.map((candidate) => {
    const words = new Set(tokens(`${candidate.job_number} ${candidate.title} ${candidate.customer_name}`));
    const number = String(candidate.job_number || '').toLowerCase().replace(/[^0-9]/g, '');
    const hitsNumber = number && spoken.replace(/[^0-9]/g, '').includes(number);
    const score = heard.filter((word) => words.has(word) && !shared.has(word)).length;
    return { candidate, score: score + (hitsNumber ? 5 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  if (scored[0]?.score > 0 && scored[0].score > (scored[1]?.score ?? 0)) return scored[0].candidate;

  const ordinal = ORDINALS.findIndex((pattern) => pattern.test(spoken));
  if (ordinal >= 0 && candidates[ordinal]) return candidates[ordinal];
  return null;
}

export function clearPendingChoice() {
  pendingChoice = null;
}

export async function moveFocusedStage(direction) {
  const jobId = getFocusedJobId();
  if (!jobId) return { ok: false, error: 'No job is focused' };
  const job = await jobsService.getJobRow(jobId);
  const stages = await stagesService.listStages();
  const idx = stages.findIndex((stage) => stage.id === job.stage_id);
  const targetIdx = direction === 'prev' ? idx - 1 : idx + 1;
  if (idx < 0 || targetIdx < 0 || targetIdx >= stages.length) {
    return { ok: false, error: 'No further stage in that direction' };
  }
  try {
    await jobsService.moveJobStage(jobId, stages[targetIdx].id, null, 'board');
    await focusJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function confirmFocus(jobId) {
  if (!jobId) return null;
  clearPendingChoice();
  // The ambiguous prompt was already spoken when board:confirm fired — no need to speak again.
  return focusJob(jobId);
}

export async function dispatchBoardAction(boardAction) {
  if (!boardAction) return;
  switch (boardAction.type) {
    case 'focus':
      await focusJob(boardAction.job_id);
      break;
    case 'details':
      await showDetails(boardAction.job_id);
      break;
    case 'artwork':
      await showArtwork(boardAction.job_id, boardAction.index || 0);
      break;
    case 'artwork_step':
      await stepArtwork(boardAction.job_id || getFocusedJobId(), boardAction.direction);
      break;
    case 'navigate':
      navigate(boardAction.action, { filter: boardAction.filter });
      break;
    case 'confirm':
      confirmCandidates(boardAction.candidates, boardAction.prompt);
      break;
    default:
      break;
  }
}

export async function ticker({ transcript, reply, userName }) {
  emitBoardTicker({
    transcript: transcript || '',
    ai_reply: reply || '',
    user_name: userName || null,
    created_at: new Date().toISOString(),
  });
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

// ---- Echo guard -------------------------------------------------------------
// The OMI pendant hears the TV speaker. Without this, the TV's own reply
// ("Pulling up Sarah Khan's job") comes back in as a new command and the board
// ends up talking to itself. We remember what the TV is saying and until when.
const TTS_LEAD_MS = 2500;
const SPEECH_TAIL_MS = 1200;
const RECENT_REPLY_MS = 25_000;
let speakingUntil = 0;
const recentReplies = [];

function estimateSpeechMs(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return Math.round((words / 2.6) * 1000) + 600;
}

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function rememberReply(text) {
  const now = Date.now();
  recentReplies.push({ text, at: now });
  while (recentReplies.length && now - recentReplies[0].at > RECENT_REPLY_MS) recentReplies.shift();
  speakingUntil = Math.max(speakingUntil, now + TTS_LEAD_MS + estimateSpeechMs(text) + SPEECH_TAIL_MS);
}

export function isBoardSpeaking() {
  return Date.now() < speakingUntil;
}

export function msUntilBoardQuiet() {
  return Math.max(0, speakingUntil - Date.now());
}

// True when an overheard transcript is mostly the words the TV just said.
export function isEchoOfBoard(text) {
  const heard = tokens(text);
  if (heard.length < 2) return false;
  const now = Date.now();
  return recentReplies.some((reply) => {
    if (now - reply.at > RECENT_REPLY_MS) return false;
    const said = new Set(tokens(reply.text));
    const ratio = heard.filter((word) => said.has(word)).length / heard.length;
    // Echoes are near-verbatim; short spoken answers ("the hoodie one") often share
    // a word or two with the question, so they need a much closer match to count.
    return heard.length >= 5 ? ratio >= 0.6 : ratio >= 0.75;
  });
}

// One board:speak per reply: with MP3 audio when TTS answers in time, otherwise
// text-only so the TV falls back to the browser voice instead of staying silent.
export async function speak(text) {
  const full = String(text || '').replace(/\s+/g, ' ').trim();
  if (!full) return;
  rememberReply(full);

  const settings = await settingsService.getSettings();
  const muted = settings.tts_enabled === false || settings.voice_tv_speaker === false;
  let audio = null;
  if (!muted) {
    const voice = settings.voice_tv_voice || settings.voice_agent_voice || 'alloy';
    audio = await withTimeout(generateSpeech(full, voice), 6000);
  }
  // Audio starts playing now, so the "TV is talking" window runs from here.
  speakingUntil = Math.max(speakingUntil, Date.now() + estimateSpeechMs(full) + SPEECH_TAIL_MS);
  emitBoardSpeak({
    audio_base64: audio?.audio_base64 || null,
    mime: audio?.mime || 'audio/mpeg',
    text: full,
    muted,
  });
  logger.info(`board:speak audio=${audio ? 'present' : 'none'} text="${full}"`);
}

const COMMON_REPLIES = [
  'Back to the board.',
  'Next file.',
  'Previous file.',
  'Next job.',
  'Previous job.',
  'Zooming.',
  'Showing overdue jobs.',
  'Showing jobs due today.',
  'Showing all jobs.',
  "Sorry, I didn't catch that.",
  'Okay, cancelled.',
];

export async function warmSpeechCache() {
  const settings = await settingsService.getSettings();
  if (settings.tts_enabled === false || settings.voice_tv_speaker === false) return;
  const voice = settings.voice_tv_voice || settings.voice_agent_voice || 'alloy';
  for (const reply of COMMON_REPLIES) {
    await generateSpeech(reply, voice);
  }
  logger.info(`speech cache warmed (${COMMON_REPLIES.length} replies)`);
}

export function listening(active) {
  emitBoardListening({ active: Boolean(active), at: new Date().toISOString() });
}

// Screen change and voice happen together: TTS generation starts immediately
// while the board update runs, instead of waiting for the board to finish first.
export async function notify({ transcript, reply, userName, boardAction }) {
  speak(reply).catch((error) => logger.error(`board speak failed: ${error.message}`));
  await ticker({ transcript, reply, userName });
  if (boardAction) await dispatchBoardAction(boardAction);
}
