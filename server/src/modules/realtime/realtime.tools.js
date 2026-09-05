import { ApiError } from '../../utils/ApiError.js';
import { emitVoiceCommand } from '../../sockets/events.js';
import * as jobsService from '../jobs/jobs.service.js';
import * as notesService from '../notes/notes.service.js';
import * as stagesService from '../stages/stages.service.js';
import * as customersService from '../customers/customers.service.js';
import * as settingsService from '../settings/settings.service.js';
import * as usersService from '../users/users.service.js';
import * as voiceService from '../voice/voice.service.js';

export const toolSchemas = [
  {
    type: 'function',
    name: 'get_due_today',
    description: 'List active jobs due today.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'get_pending_jobs',
    description: 'Count and summarize active jobs.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'get_job_status',
    description: 'Look up one job by number, customer, or title.',
    parameters: {
      type: 'object',
      properties: { job_ref: { type: 'string' } },
      required: ['job_ref'],
    },
  },
  {
    type: 'function',
    name: 'resolve_job',
    description: 'Find matching jobs for a spoken reference. Call this when the job is unclear.',
    parameters: {
      type: 'object',
      properties: { job_ref: { type: 'string' } },
      required: ['job_ref'],
    },
  },
  {
    type: 'function',
    name: 'create_job',
    description: 'Create a job. Creates the customer if needed.',
    parameters: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        title: { type: 'string' },
        product_type: { type: 'string' },
        quantity: { type: 'number' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
      },
      required: ['customer_name'],
    },
  },
  {
    type: 'function',
    name: 'move_stage',
    description: 'Move a job to a stage. Use confirmed=true only after the user agrees to skip stages.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string' },
        stage: { type: 'string' },
        confirmed: { type: 'boolean' },
      },
      required: ['job_id', 'stage'],
    },
  },
  {
    type: 'function',
    name: 'add_note',
    description: 'Add a note to a job.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['job_id', 'note'],
    },
  },
  {
    type: 'function',
    name: 'assign_job',
    description: 'Assign a job to a staff member by name, or to the caller if no name.',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string' },
        user_name: { type: 'string' },
      },
      required: ['job_id'],
    },
  },
  {
    type: 'function',
    name: 'end_session',
    description: 'End the voice session when the user says stop or goodbye.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function compactJob(job) {
  return {
    id: job.id,
    job_number: job.job_number,
    title: job.title,
    customer_name: job.customer_name || job.customer?.name || null,
    stage: job.stage?.name || job.stage_name || null,
    due_date: job.due_date || null,
  };
}

function defaultDeps() {
  return {
    listJobs: (filters) => jobsService.listJobs(filters),
    listActiveJobSummaries: () => jobsService.listActiveJobSummaries(),
    matchJobsByRef: (ref, jobs) => jobsService.matchJobsByRef(ref, jobs),
    getJob: (id) => jobsService.getJob(id),
    createJob: (payload, userId, options) => jobsService.createJob(payload, userId, options),
    moveJobStage: (id, stageId, userId, source, options) =>
      jobsService.moveJobStage(id, stageId, userId, source, options),
    assignJob: (id, userId) => jobsService.assignJob(id, userId),
    createNote: (jobId, note, userId, source) => notesService.createNote(jobId, note, userId, source),
    findOrCreateByName: (name, userId) => customersService.findOrCreateByName(name, userId),
    listStages: () => stagesService.listStages(),
    findStageByName: (name) => stagesService.findStageByName(name),
    listUsers: () => usersService.listUsers(),
    getSettings: () => settingsService.getSettings(),
    saveVoiceCommand: (row) => voiceService.saveVoiceCommand(row),
    emitVoiceCommand: (row) => emitVoiceCommand(row),
  };
}

export function createToolExecutor(overrides = {}) {
  const deps = { ...defaultDeps(), ...overrides };

  async function record(user, action, transcript, extra = {}) {
    const row = {
      transcript,
      user_id: user?.id || null,
      intent: { action, source: 'realtime', ...extra.intent },
      action,
      status: extra.status || 'executed',
      job_id: extra.job_id || null,
      error: extra.error || null,
      source: 'realtime',
    };
    try {
      const saved = await deps.saveVoiceCommand(row);
      deps.emitVoiceCommand?.(saved);
      return saved;
    } catch {
      const fallback = { ...row };
      delete fallback.source;
      const saved = await deps.saveVoiceCommand(fallback);
      deps.emitVoiceCommand?.(saved);
      return saved;
    }
  }

  async function resolveMatches(jobRef) {
    const jobs = await deps.listActiveJobSummaries();
    return deps.matchJobsByRef(jobRef, jobs);
  }

  return async function executeTool(name, args = {}, user = {}) {
    try {
      switch (name) {
        case 'get_due_today': {
          const { items } = await deps.listJobs({
            status: 'active',
            due_from: todayIso(),
            due_to: todayIso(),
            page: 1,
            limit: 20,
          });
          const jobs = (items || []).map(compactJob);
          await record(user, 'due_today', 'get_due_today');
          return { ok: true, result: { jobs, count: jobs.length } };
        }
        case 'get_pending_jobs': {
          const { items, total } = await deps.listJobs({ status: 'active', page: 1, limit: 20 });
          await record(user, 'pending_jobs', 'get_pending_jobs');
          return { ok: true, result: { total, jobs: (items || []).map(compactJob) } };
        }
        case 'resolve_job': {
          const matches = await resolveMatches(args.job_ref);
          const candidates = matches.map(compactJob);
          return { ok: true, result: { candidates, count: candidates.length } };
        }
        case 'get_job_status': {
          const matches = await resolveMatches(args.job_ref);
          if (matches.length !== 1) {
            return { ok: true, result: { candidates: matches.map(compactJob), count: matches.length } };
          }
          const job = await deps.getJob(matches[0].id);
          await record(user, 'job_status', `status ${args.job_ref}`, { job_id: job.id });
          return { ok: true, result: compactJob(job) };
        }
        case 'create_job': {
          const customerName = args.customer_name || 'Walk-in';
          const customer = await deps.findOrCreateByName(customerName, user.id);
          const job = await deps.createJob(
            {
              customer_id: customer.id,
              title: args.title || args.product_type || `${customerName} job`,
              product_type: args.product_type,
              quantity: args.quantity || 1,
              due_date: args.due_date,
              priority: args.priority,
            },
            user.id,
            { source: 'voice' }
          );
          await record(user, 'create_job', `create job for ${customerName}`, { job_id: job.id });
          return { ok: true, result: compactJob(job) };
        }
        case 'move_stage': {
          const stage = await deps.findStageByName(args.stage);
          if (!stage) throw new ApiError(400, 'Unknown stage');
          const job = await deps.getJob(args.job_id);
          const stages = await deps.listStages();
          const settings = await deps.getSettings();
          const fromIdx = stages.findIndex((row) => row.id === job.stage_id);
          const toIdx = stages.findIndex((row) => row.id === stage.id);
          const skipping = fromIdx >= 0 && toIdx >= 0 && Math.abs(toIdx - fromIdx) > 1;
          const allowSkip = Boolean(settings.voice_allow_skip) || Boolean(args.confirmed);
          if (skipping && !allowSkip) {
            return {
              ok: false,
              needs_confirmation: true,
              error: `Can't skip from ${stages[fromIdx]?.name || 'this stage'} to ${stage.name}`,
              result: {
                job: compactJob(job),
                from: stages[fromIdx]?.name,
                to: stage.name,
              },
            };
          }
          const moved = await deps.moveJobStage(job.id, stage.id, user.id, 'voice', {
            allowSkip,
          });
          await record(user, 'move_stage', `move ${job.job_number} to ${stage.name}`, { job_id: job.id });
          return { ok: true, result: compactJob(moved) };
        }
        case 'add_note': {
          const note = await deps.createNote(args.job_id, args.note, user.id, 'voice');
          await record(user, 'add_note', args.note, { job_id: args.job_id });
          return { ok: true, result: { id: note.id, job_id: args.job_id, note: args.note } };
        }
        case 'assign_job': {
          let assigneeId = user.id;
          if (args.user_name) {
            const users = await deps.listUsers();
            const q = String(args.user_name).toLowerCase();
            const match = (users || []).find((row) => String(row.full_name || '').toLowerCase().includes(q));
            if (match) assigneeId = match.id;
          }
          const job = await deps.assignJob(args.job_id, assigneeId);
          await record(user, 'assign_job', `assign ${args.job_id}`, { job_id: args.job_id });
          return { ok: true, result: compactJob(job) };
        }
        case 'end_session':
          return { ok: true, result: { ended: true } };
        default:
          return { ok: false, error: `Unknown tool ${name}` };
      }
    } catch (error) {
      const message = error.message || 'Tool failed';
      await record(user, name, name, { status: 'failed', error: message, job_id: args.job_id }).catch(() => null);
      return { ok: false, error: message };
    }
  };
}

export const executeTool = createToolExecutor();
