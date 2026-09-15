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
    'focus_job',
    'show_details',
    'show_artwork',
    'next_artwork',
    'prev_artwork',
    'zoom_artwork',
    'next_job',
    'prev_job',
    'filter_jobs',
    'back_to_board',
    'unknown',
  ]),
  job_ref: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  product_type: z.string().nullable().optional(),
  print_type: z.string().nullable().optional(),
  size_details: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  artwork_index: z.number().nullable().optional(),
  filter: z.string().nullable().optional(),
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

function resolveJobWithFocus(intent, jobs, focusedJobId) {
  if (intent.job_ref) {
    return resolveJob(intent, jobs);
  }
  if (focusedJobId) {
    const job = jobs.find((item) => item.id === focusedJobId) || null;
    return { matches: job ? [job] : [], job };
  }
  return { matches: [], job: null };
}

const AMBIGUITY_REQUIRES_CONFIRMATION = new Set([
  'move_stage',
  'add_note',
  'job_status',
  'assign_job',
  'show_details',
  'show_artwork',
]);

export function needsConfirmation(intent, matches, autoExecute, threshold = 0.7) {
  if (!autoExecute) return true;
  if (intent.confidence < Number(threshold)) return true;
  if (AMBIGUITY_REQUIRES_CONFIRMATION.has(intent.action)) {
    return matches.length !== 1;
  }
  return false;
}

const ADVANCE_STAGE_WORDS = new Set(['', 'next', 'forward', 'done', 'ready', 'finished', 'complete', 'completed']);

function describeCandidate(job, allMatches) {
  const label = job.customer_name || job.job_number;
  const duplicate = allMatches.filter((item) => (item.customer_name || item.job_number) === label).length > 1;
  return duplicate ? `${label}'s ${job.title || job.job_number}` : label;
}

export async function executeIntent(intent, { userId, jobs, allowSkip = false, focusedJobId = null }) {
  switch (intent.action) {
    case 'create_job': {
      const customerName = intent.customer_name || 'Walk-in';
      const customer = await customersService.findOrCreateByName(customerName, userId);
      const stage = intent.stage ? await stagesService.findStageByName(intent.stage) : null;
      const job = await jobsService.createJob(
        {
          customer_id: customer.id,
          title: intent.title || intent.product_type || `${customerName} job`,
          product_type: intent.product_type,
          print_type: intent.print_type,
          size_details: intent.size_details || intent.note,
          quantity: intent.quantity || 1,
          due_date: intent.due_date,
          stage_id: stage?.id,
        },
        userId,
        { source: 'voice', role: 'staff' }
      );
      return {
        result: job,
        reply: intent.reply || `Created job ${job.job_number} for ${customer.name}.`,
        job_id: job.id,
      };
    }
    case 'move_stage': {
      const { job } = resolveJobWithFocus(intent, jobs, focusedJobId);
      if (!job) {
        throw new ApiError(400, 'Could not resolve job');
      }
      const stages = await stagesService.listStages();
      const stageRef = String(intent.stage || '').trim().toLowerCase();
      let stage = null;
      if (ADVANCE_STAGE_WORDS.has(stageRef)) {
        const currentIdx = stages.findIndex((item) => item.id === job.stage_id);
        stage = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;
        if (!stage) {
          throw new ApiError(400, `${job.job_number} is already at the final stage`);
        }
      } else {
        stage = await stagesService.findStageByName(intent.stage);
      }
      if (!stage) {
        throw new ApiError(400, 'Could not resolve stage');
      }
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
        board_action: { type: 'focus', job_id: job.id },
      };
    }
    case 'add_note': {
      const { job } = resolveJobWithFocus(intent, jobs, focusedJobId);
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
      const { job } = resolveJobWithFocus(intent, jobs, focusedJobId);
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
      const { job } = resolveJobWithFocus(intent, jobs, focusedJobId);
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
    case 'focus_job': {
      const matches = jobsService.matchJobsByRef(intent.job_ref, jobs);
      if (!matches.length) {
        return {
          result: null,
          reply: intent.reply || `I don't see a job for ${intent.job_ref || 'that'}.`,
          job_id: null,
        };
      }
      if (matches.length > 1) {
        const names = matches.map((item) => describeCandidate(item, matches)).join(', ');
        const prompt = intent.reply || `Which one — ${names}?`;
        return {
          result: matches,
          reply: prompt,
          job_id: null,
          board_action: { type: 'confirm', candidates: matches, prompt },
        };
      }
      return {
        result: matches[0],
        reply: intent.reply || `Here's ${matches[0].job_number} for ${matches[0].customer_name}.`,
        job_id: matches[0].id,
        board_action: { type: 'focus', job_id: matches[0].id },
      };
    }
    case 'show_details': {
      const { job } = resolveJobWithFocus(intent, jobs, focusedJobId);
      if (!job) {
        throw new ApiError(400, 'No job is focused right now');
      }
      return {
        result: job,
        reply: intent.reply || `Here are the details for ${job.job_number}.`,
        job_id: job.id,
        board_action: { type: 'details', job_id: job.id },
      };
    }
    case 'show_artwork': {
      const { job } = resolveJobWithFocus(intent, jobs, focusedJobId);
      if (!job) {
        throw new ApiError(400, 'No job is focused right now');
      }
      const index = Number.isInteger(intent.artwork_index) ? intent.artwork_index : 0;
      return {
        result: job,
        reply: intent.reply || `Showing artwork for ${job.job_number}.`,
        job_id: job.id,
        board_action: { type: 'artwork', job_id: job.id, index },
      };
    }
    case 'next_artwork':
    case 'prev_artwork': {
      if (!focusedJobId) {
        throw new ApiError(400, 'No job is focused right now');
      }
      const direction = intent.action === 'next_artwork' ? 'next' : 'prev';
      return {
        result: null,
        reply: intent.reply || (direction === 'next' ? 'Next file.' : 'Previous file.'),
        job_id: focusedJobId,
        board_action: { type: 'artwork_step', job_id: focusedJobId, direction },
      };
    }
    case 'zoom_artwork': {
      if (!focusedJobId) {
        throw new ApiError(400, 'No job is focused right now');
      }
      return {
        result: null,
        reply: intent.reply || 'Zooming in.',
        job_id: focusedJobId,
        board_action: { type: 'navigate', action: 'zoom' },
      };
    }
    case 'next_job':
    case 'prev_job': {
      return {
        result: null,
        reply: intent.reply || (intent.action === 'next_job' ? 'Next job.' : 'Previous job.'),
        job_id: null,
        board_action: { type: 'navigate', action: intent.action === 'next_job' ? 'next' : 'prev' },
      };
    }
    case 'filter_jobs': {
      const filter = ['overdue', 'today', 'all'].includes(intent.filter) ? intent.filter : 'all';
      return {
        result: null,
        reply: intent.reply || `Showing ${filter === 'all' ? 'all' : filter} jobs.`,
        job_id: null,
        board_action: { type: 'navigate', action: 'filter', filter },
      };
    }
    case 'back_to_board': {
      return {
        result: null,
        reply: intent.reply || 'Back to the board.',
        job_id: null,
        board_action: { type: 'navigate', action: 'back' },
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

export { resolveJob, resolveJobWithFocus };
