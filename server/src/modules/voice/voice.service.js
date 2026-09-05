import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import { emitVoiceCommand } from '../../sockets/events.js';
import * as settingsService from '../settings/settings.service.js';
import * as jobsService from '../jobs/jobs.service.js';
import { executeIntent, needsConfirmation, parseIntent, resolveJob } from './intent.service.js';
import * as stagesService from '../stages/stages.service.js';

function startsWithTrigger(transcript, trigger) {
  const word = (trigger || '').trim().toLowerCase();
  if (!word) return true;
  return transcript.trim().toLowerCase().startsWith(word);
}

function stripTrigger(transcript, trigger) {
  const word = (trigger || '').trim();
  if (!word) return transcript.trim();
  return transcript.trim().replace(new RegExp(`^${word}\\s*`, 'i'), '').trim();
}

export async function findProfileByOmiUid(omiUid) {
  if (!omiUid) return null;
  return unwrap(
    await supabase.from('profiles').select('*').eq('omi_uid', omiUid).maybeSingle(),
    'Failed to look up OMI user'
  );
}

export async function saveVoiceCommand(row) {
  return unwrap(
    await supabase.from('voice_commands').insert(row).select('*').single(),
    'Failed to save voice command'
  );
}

export async function updateVoiceCommand(id, patch) {
  return unwrap(
    await supabase.from('voice_commands').update(patch).eq('id', id).select('*').single(),
    'Failed to update voice command'
  );
}

export async function getVoiceCommand(id) {
  const row = unwrap(
    await supabase.from('voice_commands').select('*').eq('id', id).maybeSingle(),
    'Failed to load voice command'
  );
  if (!row) {
    throw new ApiError(404, 'Voice command not found');
  }
  return row;
}

export async function listHistory({ page = 1, limit = 20, status, user } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = supabase
    .from('voice_commands')
    .select(
      '*, user:profiles!user_id(id, full_name, email), job:jobs!job_id(id, job_number)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);
  if (user) query = query.eq('user_id', user);

  const result = await query;
  const items = (unwrap(result, 'Failed to load voice history') || []).map((row) => ({
    ...row,
    user_name: row.user?.full_name || null,
    job_number: row.job?.job_number || null,
    action: row.action || row.intent?.action || null,
  }));

  const enriched = await enrichPending(items);

  return {
    items: enriched,
    page,
    limit,
    total: result.count ?? 0,
  };
}

async function enrichPending(items) {
  const pending = (items || []).some((row) => row.status === 'pending_confirmation');
  if (!pending) return items;

  const [jobs, stages] = await Promise.all([
    jobsService.listActiveJobSummaries(),
    stagesService.listStages(),
  ]);

  return items.map((row) => {
    if (row.status !== 'pending_confirmation') return row;
    const matches = jobsService.matchJobsByRef(row.intent?.job_ref, jobs);
    let kind = 'confirm';
    let question = row.intent?.reply || 'Do this command?';
    if (matches.length > 1) {
      kind = 'ambiguous';
      const who = row.user_name || 'they';
      question = `Which job did ${who} mean?`;
    } else if (row.intent?.action === 'move_stage' && matches.length === 1) {
      const job = matches[0];
      const targetName = row.intent?.stage;
      const target = stages.find(
        (stage) =>
          stage.name.toLowerCase() === String(targetName || '').toLowerCase() ||
          stage.slug === String(targetName || '').toLowerCase() ||
          (stage.aliases || []).some((alias) => alias.toLowerCase() === String(targetName || '').toLowerCase())
      );
      const fromIdx = stages.findIndex((stage) => stage.id === job.stage_id);
      const toIdx = target ? stages.findIndex((stage) => stage.id === target.id) : -1;
      if (fromIdx >= 0 && toIdx >= 0 && Math.abs(toIdx - fromIdx) > 1) {
        kind = 'skip';
        question = `${job.job_number} is in ${stages[fromIdx].name} — skip straight to ${stages[toIdx].name}?`;
      }
    }
    return {
      ...row,
      candidates: matches.map((job) => ({
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        customer_name: job.customer_name,
      })),
      confirmation: { kind, question },
    };
  });
}

export async function runIntentPipeline({ transcript, userId = null, omiUid = null }) {
  const settings = await settingsService.getSettings();
  const trigger = settings.voice_trigger_word || '';
  const autoExecute = settings.voice_auto_execute !== false;

  if (!startsWithTrigger(transcript, trigger)) {
    return {
      ignored: true,
      message: 'Transcript ignored; trigger word not present.',
    };
  }

  const cleaned = stripTrigger(transcript, trigger) || transcript;
  let parsed;
  try {
    parsed = await parseIntent(cleaned);
  } catch (error) {
    const failed = await saveVoiceCommand({
      transcript: cleaned,
      omi_uid: omiUid,
      user_id: userId,
      intent: { error: error.message },
      action: 'unknown',
      status: 'failed',
      error: error.message,
    });
    emitVoiceCommand(failed);
    return { command: failed, message: 'Sorry, I could not understand that.' };
  }

  const { intent, jobs } = parsed;
  if (intent.action === 'unknown') {
    return { ignored: true, message: '' };
  }

  const { matches, job } = resolveJob(intent, jobs);
  const threshold = settings.voice_confidence_threshold ?? 0.7;
  const pending = needsConfirmation(intent, matches, autoExecute, threshold);

  if (pending) {
    const command = await saveVoiceCommand({
      transcript: cleaned,
      omi_uid: omiUid,
      user_id: userId,
      intent,
      action: intent.action,
      status: 'pending_confirmation',
      job_id: job?.id || null,
      error: matches.length > 1 ? 'Multiple matching jobs' : null,
    });
    emitVoiceCommand(command);
    const message =
      matches.length > 1
        ? `I found more than one match. Please confirm which job you mean.`
        : intent.reply || 'Please confirm that command.';
    return { command, message, needs_confirmation: true };
  }

  try {
    const executed = await executeIntent(intent, { userId, jobs });
    const command = await saveVoiceCommand({
      transcript: cleaned,
      omi_uid: omiUid,
      user_id: userId,
      intent,
      action: intent.action,
      status: 'executed',
      job_id: executed.job_id,
    });
    emitVoiceCommand(command);
    return { command, message: executed.reply, result: executed.result };
  } catch (error) {
    const command = await saveVoiceCommand({
      transcript: cleaned,
      omi_uid: omiUid,
      user_id: userId,
      intent,
      action: intent.action,
      status: 'failed',
      job_id: job?.id || null,
      error: error.message,
    });
    emitVoiceCommand(command);
    return { command, message: error.message || 'Command failed.' };
  }
}

export async function confirmCommand(id, userId, { job_id, allow_skip } = {}) {
  const command = await getVoiceCommand(id);
  if (command.status !== 'pending_confirmation') {
    throw new ApiError(400, 'Command is not waiting for confirmation');
  }

  const jobs = await jobsService.listActiveJobSummaries();
  const intent = { ...command.intent };
  if (job_id) {
    const selected = jobs.find((job) => job.id === job_id);
    if (selected) intent.job_ref = selected.job_number;
  }
  const executed = await executeIntent(intent, {
    userId: userId || command.user_id,
    jobs,
    allowSkip: Boolean(allow_skip),
  });
  const updated = await updateVoiceCommand(id, {
    status: 'executed',
    job_id: executed.job_id,
    error: null,
  });
  emitVoiceCommand(updated);
  return { command: updated, message: executed.reply, result: executed.result };
}

export async function rejectCommand(id) {
  const command = await getVoiceCommand(id);
  if (command.status !== 'pending_confirmation') {
    throw new ApiError(400, 'Command is not waiting for confirmation');
  }
  const updated = await updateVoiceCommand(id, { status: 'rejected' });
  emitVoiceCommand(updated);
  return updated;
}
