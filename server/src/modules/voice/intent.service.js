import { z } from 'zod';
import { openai } from '../../config/openai.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import * as jobsService from '../jobs/jobs.service.js';
import * as notesService from '../notes/notes.service.js';
import * as stagesService from '../stages/stages.service.js';
import * as customersService from '../customers/customers.service.js';
import * as settingsService from '../settings/settings.service.js';
import { buildIntentPrompt } from './intent.prompt.js';

const intentSchema = z.object({
  action: z.enum([
    'create_job',
    'move_stage',
    'add_note',
    'job_status',
    'due_today',
    'pending_jobs',
    'assign_job',
    'unknown',
  ]),
  job_ref: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  product_type: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  reply: z.string(),
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function parseIntent(transcript) {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(500, 'OPENAI_API_KEY is not configured');
  }

  const [stages, jobs] = await Promise.all([
    stagesService.listStages(),
    jobsService.listActiveJobSummaries(),
  ]);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: buildIntentPrompt({ stages, jobs, today: todayIso() }),
      },
      { role: 'user', content: transcript },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new ApiError(502, 'Empty response from OpenAI');
  }

  let parsed;
  try {
    parsed = intentSchema.parse(JSON.parse(raw));
  } catch (error) {
    logger.error('Invalid intent JSON', error);
    throw new ApiError(502, 'Failed to parse voice intent');
  }

  return { intent: parsed, stages, jobs };
}

function resolveJob(intent, jobs) {
  const matches = jobsService.matchJobsByRef(intent.job_ref, jobs);
  return { matches, job: matches.length === 1 ? matches[0] : null };
}

export function needsConfirmation(intent, matches, autoExecute, threshold = 0.7) {
  if (!autoExecute) return true;
  if (intent.confidence < Number(threshold)) return true;
  if (['move_stage', 'add_note', 'job_status', 'assign_job'].includes(intent.action)) {
    return matches.length !== 1;
  }
  return false;
}

export async function executeIntent(intent, { userId, jobs, allowSkip = false }) {
  switch (intent.action) {
    case 'create_job': {
      const customerName = intent.customer_name || 'Walk-in';
      const customer = await customersService.findOrCreateByName(customerName, userId);
      const stage = intent.stage ? await stagesService.findStageByName(intent.stage) : null;
      const job = await jobsService.createJob(
        {
          customer_id: customer.id,
          title: intent.product_type || `${customerName} job`,
          product_type: intent.product_type,
          quantity: intent.quantity || 1,
          due_date: intent.due_date,
          stage_id: stage?.id,
        },
        userId,
        { source: 'voice' }
      );
      return {
        result: job,
        reply: intent.reply || `Created job ${job.job_number} for ${customer.name}.`,
        job_id: job.id,
      };
    }
    case 'move_stage': {
      const { job } = resolveJob(intent, jobs);
      const stage = await stagesService.findStageByName(intent.stage);
      if (!job || !stage) {
        throw new ApiError(400, 'Could not resolve job or stage');
      }
      const stages = await stagesService.listStages();
      const fromIdx = stages.findIndex((item) => item.id === job.stage_id);
      const toIdx = stages.findIndex((item) => item.id === stage.id);
      const settings = await settingsService.getSettings();
      if (!allowSkip && !settings.voice_allow_skip && fromIdx >= 0 && toIdx >= 0 && Math.abs(toIdx - fromIdx) > 1) {
        const fromName = stages[fromIdx]?.name || 'this stage';
        throw new ApiError(400, `Can't skip from ${fromName} to ${stage.name}`);
      }
      const moved = await jobsService.moveJobStage(job.id, stage.id, userId, 'voice');
      return {
        result: moved,
        reply: intent.reply || `Moved ${job.job_number} to ${stage.name}.`,
        job_id: job.id,
      };
    }
    case 'add_note': {
      const { job } = resolveJob(intent, jobs);
      if (!job || !intent.note) {
        throw new ApiError(400, 'Could not resolve job or note');
      }
      const note = await notesService.createNote(job.id, intent.note, userId, 'voice');
      return {
        result: note,
        reply: intent.reply || `Added a note to ${job.job_number}.`,
        job_id: job.id,
      };
    }
    case 'assign_job': {
      const { job } = resolveJob(intent, jobs);
      if (!job) {
        throw new ApiError(400, 'Could not resolve job');
      }
      const assigned = await jobsService.assignJob(job.id, userId);
      return {
        result: assigned,
        reply: intent.reply || `Assigned ${job.job_number} to you.`,
        job_id: job.id,
      };
    }
    case 'job_status': {
      const { job } = resolveJob(intent, jobs);
      if (!job) {
        throw new ApiError(400, 'Could not resolve job');
      }
      const detail = await jobsService.getJob(job.id);
      return {
        result: detail,
        reply:
          intent.reply ||
          `${detail.job_number} for ${detail.customer?.name || 'the customer'} is in ${detail.stage?.name}.`,
        job_id: job.id,
      };
    }
    case 'due_today': {
      const { items } = await jobsService.listJobs({
        status: 'active',
        due_from: todayIso(),
        due_to: todayIso(),
        page: 1,
        limit: 20,
      });
      const names = (items || []).map((job) => job.job_number).join(', ');
      return {
        result: items,
        reply: intent.reply || (names ? `Jobs due today: ${names}.` : 'No jobs are due today.'),
        job_id: null,
      };
    }
    case 'pending_jobs': {
      const { items, total } = await jobsService.listJobs({
        status: 'active',
        page: 1,
        limit: 20,
      });
      return {
        result: items,
        reply: intent.reply || `There are ${total} active jobs.`,
        job_id: null,
      };
    }
    default:
      return {
        result: null,
        reply: intent.reply || 'I did not understand that command.',
        job_id: null,
      };
  }
}

export { resolveJob };
