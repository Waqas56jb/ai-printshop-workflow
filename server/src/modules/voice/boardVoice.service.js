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
  hasBoardSockets,
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

async function ensureFocus(jobId) {
  const [job, stages] = await Promise.all([jobsService.getJob(jobId), stagesService.listStages()]);
  const payload = payloadFromJob(job, stages);
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
  if (action === 'back') clearBoardSession();
  if (action === 'filter') updateBoardSession({ board_filter: extra.filter || 'all' });
}

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
  emitBoardConfirm(payload);
  logger.info(`board:confirm ${JSON.stringify(payload)}`);
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

export async function speak(text) {
  const settings = await settingsService.getSettings();
  const full = String(text || '').replace(/\s+/g, ' ').trim();
  if (!full) return;

  const gatedOff = settings.tts_enabled === false || settings.voice_tv_speaker === false;
  let audio = null;
  if (!gatedOff && (hasBoardSockets() || process.env.VERCEL)) {
    const voice = settings.voice_tv_voice || settings.voice_agent_voice || 'alloy';
    audio = await generateSpeech(full, voice);
  }

  const payload = {
    audio_base64: audio?.audio_base64 || null,
    mime: audio?.mime || 'audio/mpeg',
    text: full,
  };
  emitBoardSpeak(payload);
  logger.info(`board:speak ${JSON.stringify({ text: full, audio: payload.audio_base64 ? 'present' : null })}`);
}

export async function notify({ transcript, reply, userName, boardAction }) {
  await ticker({ transcript, reply, userName });
  if (boardAction) await dispatchBoardAction(boardAction);
  await speak(reply);
}
