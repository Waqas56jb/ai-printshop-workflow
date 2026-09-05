import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import * as settingsService from '../settings/settings.service.js';
import * as stagesService from '../stages/stages.service.js';
import * as jobsService from '../jobs/jobs.service.js';
import { executeTool, toolSchemas } from './realtime.tools.js';

const SESSION_URL = 'https://api.openai.com/v1/realtime/sessions';

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function buildInstructions({ shopName, callerName, role, stages, jobs }) {
  const stageLines = (stages || [])
    .map((stage) => {
      const aliases = (stage.aliases || []).filter(Boolean).join(', ');
      return `- ${stage.name}${aliases ? ` (aliases: ${aliases})` : ''}`;
    })
    .join('\n');
  const jobLines = (jobs || [])
    .slice(0, 60)
    .map((job) => {
      const customer = job.customer_name || job.customer?.name || '—';
      const stage = job.stage?.name || job.stage_name || '—';
      return `- ${job.job_number}: ${customer} / ${job.title} · ${stage} · due ${job.due_date || 'n/a'}`;
    })
    .join('\n');

  return `You are the print shop assistant for ${shopName || 'Print Shop'}.
Today is ${todayLabel()}.
The caller is ${callerName || 'a staff member'} (${role || 'staff'}).

Stages:
${stageLines || '- (none)'}

Active jobs:
${jobLines || '- (none)'}

Rules:
- Keep replies to one short sentence.
- Always call a tool for any action or lookup; never invent job numbers.
- If a job reference matches more than one job, call resolve_job first and ask the user which one.
- Confirm destructive or skip-stage moves before doing them. Call move_stage with confirmed=true only after they agree.
- If the user says stop, call end_session.`;
}

export async function getAgentConfig() {
  const settings = await settingsService.getSettings();
  return {
    enabled: settings.voice_agent_enabled !== false,
    voice: settings.voice_agent_voice || 'alloy',
    model: env.REALTIME_MODEL || 'gpt-4o-realtime-preview',
  };
}

async function compactActiveJobs() {
  const [stages, { items }] = await Promise.all([
    stagesService.listStages(),
    jobsService.listJobs({ status: 'active', page: 1, limit: 60 }),
  ]);
  const stageById = new Map((stages || []).map((stage) => [stage.id, stage]));
  return (items || []).map((job) => ({
    id: job.id,
    job_number: job.job_number,
    title: job.title,
    customer_name: job.customer?.name || null,
    stage_name: stageById.get(job.stage_id)?.name || job.stage?.name || null,
    due_date: job.due_date,
  }));
}

export async function createSession(user, fetchImpl = fetch, loaders = {}) {
  const apiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, 'OPENAI_API_KEY is not configured');
  }

  const settings = await (loaders.getSettings || settingsService.getSettings)();
  if (settings.voice_agent_enabled === false) {
    throw new ApiError(403, 'Voice assistant is turned off');
  }

  const [stages, jobs] = await Promise.all([
    (loaders.listStages || stagesService.listStages)(),
    loaders.listJobs ? loaders.listJobs() : compactActiveJobs(),
  ]);
  const model = env.REALTIME_MODEL || 'gpt-4o-realtime-preview';
  const voice = settings.voice_agent_voice || 'alloy';
  const body = {
    model,
    voice,
    modalities: ['audio', 'text'],
    input_audio_transcription: { model: 'whisper-1' },
    turn_detection: { type: 'server_vad', silence_duration_ms: 600 },
    instructions: buildInstructions({
      shopName: settings.business_name,
      callerName: user?.profile?.full_name || user?.email,
      role: user?.role,
      stages,
      jobs,
    }),
    tools: toolSchemas,
    tool_choice: 'auto',
  };

  const response = await fetchImpl(SESSION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, payload.error?.message || 'Could not start a realtime session');
  }

  const clientSecret =
    typeof payload.client_secret === 'string'
      ? payload.client_secret
      : payload.client_secret?.value || '';
  if (!clientSecret) {
    throw new ApiError(502, 'Realtime session did not return a client secret');
  }

  return {
    client_secret: clientSecret,
    model: payload.model || model,
    expires_at: payload.client_secret?.expires_at || payload.expires_at || null,
  };
}

export async function runTool(name, args, user) {
  if (!name) throw new ApiError(400, 'Tool name is required');
  return executeTool(name, args || {}, user);
}

export function assertNoApiKeyLeak(payload) {
  const text = JSON.stringify(payload);
  return !text.includes(env.OPENAI_API_KEY || 'sk-') || !env.OPENAI_API_KEY;
}
