import { z } from 'zod';
import { openai } from '../../config/openai.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import * as jobsService from '../jobs/jobs.service.js';
import * as notesService from '../notes/notes.service.js';
import * as stagesService from '../stages/stages.service.js';
import * as customersService from '../customers/customers.service.js';
import { buildIntentPrompt } from './intent.prompt.js';
import { fastIntent } from './fastIntent.js';

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

// Stage + active-job lists for matching, reused across back-to-back voice
// commands to save two DB round trips. Cleared after any voice-driven change;
// moves re-read the job's live stage anyway (see move_stage below).
const CONTEXT_TTL_MS = 8000;
let contextCache = { at: 0, promise: null };

export function invalidateIntentContext() {
  contextCache = { at: 0, promise: null };
}

function loadIntentContext() {
  if (!contextCache.promise || Date.now() - contextCache.at > CONTEXT_TTL_MS) {
    const promise = Promise.all([stagesService.listStages(), jobsService.listActiveJobSummaries()]).then(
      ([stages, jobs]) => ({ stages, jobs })
    );
    contextCache = { at: Date.now(), promise };
    promise.catch(() => {
      if (contextCache.promise === promise) contextCache = { at: 0, promise: null };
    });
  }
  return contextCache.promise;
}

// Command detection for always-on OMI speech (no wake word). A fast-path match
// is a definite command; `looksLikeCommand` covers phrasings that need GPT to
// fill in details (new job, notes, assign, status) but are clearly commands.
export async function detectFastIntent(text) {
  const { stages, jobs } = await loadIntentContext();
  return fastIntent(text, { jobs, stages });
}

export { looksLikeCommand } from './fastIntent.js';

const CLASSIFIER_PROMPT = `You label one utterance overheard by a wearable mic in a print shop.
Reply with exactly one word.
COMMAND = the speaker is telling the shop's job board / assistant to do something with jobs, orders, customers, artwork, stages, notes, or the TV board. Examples: "pull up Sarah's job", "move the gym banners to printing", "new job for Ali, fifty hoodies", "sarah ki job printing me daal do", "what's left for today".
CHAT = ordinary conversation between people, even if it mentions customers, orders or products. Examples: "she's coming to pick this up later", "I'll grab the banners after lunch", "I had biryani for lunch", "did you call Metro Gym?".`;

// Cheap yes/no gate for utterances the fast path doesn't recognise. Any failure
// counts as CHAT so an outage can never turn conversation into actions.
export async function classifyCommand(text) {
  if (!env.OPENAI_API_KEY) return 'CHAT';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 5,
      messages: [
        { role: 'system', content: CLASSIFIER_PROMPT },
        { role: 'user', content: text },
      ],
    });
    return /command/i.test(completion.choices[0]?.message?.content || '') ? 'COMMAND' : 'CHAT';
  } catch (error) {
    logger.error(`command classifier failed: ${error.message}`);
    return 'CHAT';
  }
}

export async function parseIntent(transcript) {
  const { stages, jobs } = await loadIntentContext();

  const quick = fastIntent(transcript, { jobs, stages });
  if (quick) {
    logger.info(`intent fast-path action=${quick.action} job_ref=${quick.job_ref || ''}`);
    return { intent: quick, stages, jobs, fast: true };
  }

  if (!env.OPENAI_API_KEY) {
    throw new ApiError(500, 'OPENAI_API_KEY is not configured');
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
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

const TV_INSTANT_ACTIONS = new Set([
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
]);

const AMBIGUITY_REQUIRES_CONFIRMATION = new Set([
  'move_stage',
  'add_note',
  'job_status',
  'assign_job',
]);

export function needsConfirmation(intent, matches, autoExecute, threshold = 0.7) {
  if (TV_INSTANT_ACTIONS.has(intent.action)) return false;
  if (!autoExecute) return true;
  if (intent.confidence < Number(threshold)) return true;
  // A stage move that matches a few jobs asks "which one?" out loud instead.
  if (intent.action === 'move_stage' && matches.length > 1 && matches.length <= 4) return false;
  if (AMBIGUITY_REQUIRES_CONFIRMATION.has(intent.action)) {
    return matches.length !== 1;
  }
  return false;
}

const ADVANCE_STAGE_WORDS = new Set(['', 'next', 'forward', 'done', 'ready', 'finished', 'complete', 'completed']);

const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five'];

// "Two jobs for Sarah — J-1042 Hoodie or J-1031 50 T-Shirts?"
function candidatesPrompt(matches) {
  const shown = matches.slice(0, 4);
  const customers = [...new Set(shown.map((job) => job.customer_name).filter(Boolean))];
  const sameCustomer = customers.length === 1;
  const forWho = sameCustomer ? ` for ${customers[0].split(/\s+/)[0]}` : '';
  const items = shown.map((job) =>
    [job.job_number, sameCustomer ? null : job.customer_name, job.title].filter(Boolean).join(' ')
  );
  const list = items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}` : items[0];
  return `${COUNT_WORDS[matches.length] || matches.length} jobs${forWho} — ${list}?`;
}

export async function executeIntent(intent, { userId, jobs, focusedJobId = null }) {
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
      invalidateIntentContext();
      return {
        result: job,
        reply: intent.reply || `Created job ${job.job_number} for ${customer.name}.`,
        job_id: job.id,
        board_action: { type: 'focus', job_id: job.id },
      };
    }
    case 'move_stage': {
      const { job: matched, matches } = resolveJobWithFocus(intent, jobs, focusedJobId);
      if (!matched && matches.length > 1) {
        // "Which one?" — the answer finishes this same move (see resolvePendingChoice).
        const prompt = candidatesPrompt(matches);
        return {
          result: matches,
          reply: prompt,
          job_id: null,
          board_action: {
            type: 'confirm',
            candidates: matches,
            prompt,
            then: { action: 'move_stage', stage: intent.stage || 'next' },
          },
        };
      }
      if (!matched) {
        throw new ApiError(400, 'Could not resolve job');
      }
      // Read the live stage: the cached job list may predate a move made in Admin.
      const [stages, live] = await Promise.all([stagesService.listStages(), jobsService.getJobRow(matched.id)]);
      const job = { ...matched, stage_id: live.stage_id };
      const stageRef = String(intent.stage || '').trim().toLowerCase();
      // A real stage name wins ("move it to ready" → the Ready stage); otherwise
      // "done" / "next" / "finished" means one stage forward.
      let stage = stages.find((item) => item.name.trim().toLowerCase() === stageRef) || null;
      if (!stage && ADVANCE_STAGE_WORDS.has(stageRef)) {
        const currentIdx = stages.findIndex((item) => item.id === job.stage_id);
        stage = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;
        if (!stage) {
          throw new ApiError(400, `${job.job_number} is already at the final stage`);
        }
      } else if (!stage) {
        stage = await stagesService.findStageByName(intent.stage);
      }
      if (!stage) {
        throw new ApiError(400, 'Could not resolve stage');
      }
      // A named stage is a deliberate jump, so any stage is allowed; "done" /
      // "next" above only ever moves one stage forward.
      const moved = await jobsService.moveJobStage(job.id, stage.id, userId, 'voice');
      invalidateIntentContext();
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
        board_action: { type: 'focus', job_id: job.id },
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
        board_action: { type: 'focus', job_id: job.id },
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
        board_action: { type: 'focus', job_id: job.id },
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
        board_action: { type: 'navigate', action: 'filter', filter: 'today' },
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
        board_action: { type: 'navigate', action: 'filter', filter: 'all' },
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
        const prompt = candidatesPrompt(matches);
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
