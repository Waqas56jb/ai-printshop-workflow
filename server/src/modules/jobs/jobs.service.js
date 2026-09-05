import { z } from 'zod';
import { openai } from '../../config/openai.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateJobNumber } from '../../utils/jobNumber.js';
import {
  emitJobCreated,
  emitJobDeleted,
  emitJobMoved,
  emitJobUpdated,
} from '../../sockets/events.js';
import * as stagesService from '../stages/stages.service.js';
import * as settingsService from '../settings/settings.service.js';

const JOB_LIST_SELECT = `
  *,
  customer:customers!customer_id(id, name, email, phone, company),
  stage:stages!stage_id(id, name, slug, color, position, is_default, is_final),
  assignee:profiles!assigned_to(id, full_name, email, role)
`;

const JOB_DETAIL_SELECT = `
  *,
  customer:customers!customer_id(*),
  stage:stages!stage_id(*),
  assignee:profiles!assigned_to(id, full_name, email, role),
  artworks:job_artworks(*),
  notes:job_notes(*, author:profiles!author_id(id, full_name, email)),
  history:job_stage_history(
    *,
    from_stage:stages!from_stage_id(id, name, slug, color),
    to_stage:stages!to_stage_id(id, name, slug, color),
    changed_by_profile:profiles!changed_by(id, full_name, email)
  )
`;

function sanitizeSearch(value) {
  return (value || '').replace(/[%_,.()]/g, ' ').trim();
}

export async function listJobs(filters) {
  const { stage, customer, assigned, status, priority, due_from, due_to, search, page, limit } = filters;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('jobs')
    .select(JOB_LIST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (stage) query = query.eq('stage_id', stage);
  if (customer) query = query.eq('customer_id', customer);
  if (assigned === 'unassigned') query = query.is('assigned_to', null);
  else if (assigned) query = query.eq('assigned_to', assigned);
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (due_from) query = query.gte('due_date', due_from);
  if (due_to) query = query.lte('due_date', due_to);

  const q = sanitizeSearch(search);
  if (q) {
    const customers = unwrap(
      await supabase.from('customers').select('id').ilike('name', `%${q}%`),
      'Failed to search customers'
    );
    const customerIds = (customers || []).map((item) => item.id);
    const parts = [`title.ilike.%${q}%`, `job_number.ilike.%${q}%`];
    if (customerIds.length) {
      parts.push(`customer_id.in.(${customerIds.join(',')})`);
    }
    query = query.or(parts.join(','));
  }

  const result = await query;
  const items = unwrap(result, 'Failed to list jobs');

  return {
    items,
    page,
    limit,
    total: result.count ?? 0,
  };
}

export async function getJob(id) {
  const job = unwrap(
    await supabase
      .from('jobs')
      .select(JOB_DETAIL_SELECT)
      .eq('id', id)
      .order('created_at', { referencedTable: 'job_notes', ascending: false })
      .order('created_at', { referencedTable: 'job_artworks', ascending: false })
      .order('created_at', { referencedTable: 'job_stage_history', ascending: false })
      .maybeSingle(),
    'Failed to load job'
  );
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }
  return job;
}

export async function getJobRow(id) {
  const job = unwrap(
    await supabase.from('jobs').select('*').eq('id', id).maybeSingle(),
    'Failed to load job'
  );
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }
  return job;
}

export async function listActiveJobSummaries() {
  const jobs = unwrap(
    await supabase
      .from('jobs')
      .select('id, job_number, title, stage_id, customer:customers!customer_id(name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(80),
    'Failed to load active jobs'
  );

  return (jobs || []).map((job) => ({
    id: job.id,
    job_number: job.job_number,
    title: job.title,
    stage_id: job.stage_id,
    customer_name: job.customer?.name || '',
  }));
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function isPrintingStage(stage) {
  const slug = String(stage?.slug || '').toLowerCase();
  const name = String(stage?.name || '').toLowerCase().trim();
  return slug === 'printing' || name === 'printing';
}

export async function createJob(payload, userId, options = {}) {
  const stage = payload.stage_id
    ? await stagesService.getStage(payload.stage_id)
    : await stagesService.getDefaultStage();

  const settings = await settingsService.getRawSettings();
  const priority = payload.priority ?? settings.default_priority ?? 'normal';
  const due_date =
    payload.due_date !== undefined && payload.due_date !== null
      ? payload.due_date
      : addDaysIso(settings.default_due_days ?? 3);

  const job_number = await generateJobNumber();
  const created = unwrap(
    await supabase
      .from('jobs')
      .insert({
        job_number,
        customer_id: payload.customer_id,
        title: payload.title,
        product_type: payload.product_type ?? null,
        quantity: payload.quantity ?? 1,
        print_type: payload.print_type ?? null,
        size_details: payload.size_details ?? null,
        price: payload.price ?? null,
        priority,
        stage_id: stage.id,
        assigned_to: payload.assigned_to ?? null,
        due_date,
        notes: payload.notes ?? null,
        status: 'active',
        created_by: userId,
      })
      .select(JOB_LIST_SELECT)
      .single(),
    'Failed to create job'
  );

  unwrap(
    await supabase.from('job_stage_history').insert({
      job_id: created.id,
      from_stage_id: null,
      to_stage_id: stage.id,
      changed_by: userId,
      source: options.source || 'manual',
    }),
    'Failed to write job history'
  );

  if (!options.silent) {
    emitJobCreated(created);
  }
  return created;
}

export async function updateJob(id, payload, options = {}) {
  await getJobRow(id);
  const updated = unwrap(
    await supabase.from('jobs').update(payload).eq('id', id).select(JOB_LIST_SELECT).single(),
    'Failed to update job'
  );
  if (!options.silent) {
    emitJobUpdated(updated);
  }
  return updated;
}

export async function moveJobStage(id, stageId, userId, source = 'manual', options = {}) {
  const job = await getJobRow(id);
  const stage = await stagesService.getStage(stageId);

  if (job.stage_id === stage.id) {
    return getJob(id);
  }

  const requireArt = await settingsService.getSetting('require_artwork_before_printing', false);
  if (requireArt && isPrintingStage(stage)) {
    const approved = unwrap(
      await supabase.from('job_artworks').select('id').eq('job_id', id).eq('is_approved', true),
      'Failed to check artwork'
    );
    if (!approved?.length) {
      throw new ApiError(
        400,
        'Approved artwork is required before moving this job to Printing'
      );
    }
  }

  unwrap(
    await supabase.from('job_stage_history').insert({
      job_id: id,
      from_stage_id: job.stage_id,
      to_stage_id: stage.id,
      changed_by: userId,
      source,
    }),
    'Failed to write job history'
  );

  const patch = { stage_id: stage.id };
  if (stage.is_final) {
    patch.status = 'completed';
    patch.completed_at = new Date().toISOString();
  } else if (job.status === 'completed') {
    patch.status = 'active';
    patch.completed_at = null;
  }

  const updated = unwrap(
    await supabase.from('jobs').update(patch).eq('id', id).select(JOB_LIST_SELECT).single(),
    'Failed to move job'
  );

  if (!options.silent) {
    emitJobMoved({
      job: updated,
      from_stage_id: job.stage_id,
      to_stage_id: stage.id,
      source,
    });
  }

  return updated;
}

export async function assignJob(id, assignedTo) {
  return updateJob(id, { assigned_to: assignedTo });
}

export async function completeJob(id, userId) {
  const finalStage = await stagesService.getFinalStage();
  if (finalStage) {
    return moveJobStage(id, finalStage.id, userId, 'manual');
  }
  return updateJob(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

export async function deleteJob(id) {
  await getJobRow(id);
  unwrap(await supabase.from('jobs').delete().eq('id', id), 'Failed to delete job');
  emitJobDeleted({ id });
  return { id };
}

export async function cleanupCompletedJobs(olderThanDays = 365) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(olderThanDays || 365));
  const rows = unwrap(
    await supabase
      .from('jobs')
      .select('id')
      .eq('status', 'completed')
      .lt('completed_at', cutoff.toISOString()),
    'Failed to find old jobs'
  ) || [];

  for (const row of rows) {
    unwrap(await supabase.from('jobs').delete().eq('id', row.id), 'Failed to delete old job');
    emitJobDeleted({ id: row.id });
  }

  return { deleted: rows.length };
}

const parseSchema = z.object({
  customer_name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  product_type: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).nullable().optional(),
});

export async function parseJobText(text) {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(500, 'OPENAI_API_KEY is not configured');
  }

  const today = new Date().toISOString().slice(0, 10);
  const settings = await settingsService.getRawSettings();
  const products = (settings.product_types || []).join(', ');
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You extract a print-shop job from a one-line description. Today's date is ${today}.
Product types often used: ${products || 'T-Shirt, Hoodie, Flyer, Business card, Banner, Sticker'}.
Return JSON with exactly:
{
  "customer_name": string|null,
  "title": string|null,
  "product_type": string|null,
  "quantity": number|null,
  "due_date": "YYYY-MM-DD"|null,
  "priority": "low"|"normal"|"high"|"urgent"|null
}
Rules:
- title should be a short job title like "50 T-Shirts" or "Menu cards".
- due_date must be YYYY-MM-DD or null. Resolve relative dates like "Friday" or "tomorrow" from today.
- quantity is a number or null.
- If something is missing, use null. Return JSON only.`,
      },
      { role: 'user', content: text },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new ApiError(502, 'Empty response from OpenAI');
  }

  try {
    return parseSchema.parse(JSON.parse(raw));
  } catch (error) {
    logger.error('Invalid job parse JSON', error);
    throw new ApiError(502, 'Failed to parse job text');
  }
}

function normalizeRef(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/\b(job|the|a|an|to|for)\b/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchJobsByRef(jobRef, summaries) {
  const q = normalizeRef(jobRef);
  if (!q) return [];

  const exactNumber = summaries.filter((job) => normalizeRef(job.job_number) === q);
  if (exactNumber.length === 1) return exactNumber;

  const tokens = q.split(' ').filter((part) => part.length > 1);
  return summaries.filter((job) => {
    const number = normalizeRef(job.job_number);
    const title = normalizeRef(job.title);
    const customer = normalizeRef(job.customer_name);
    const hay = `${number} ${title} ${customer}`;
    if (hay.includes(q) || q.includes(number) || (title && q.includes(title)) || (customer && q.includes(customer))) {
      return true;
    }
    return tokens.length > 0 && tokens.every((token) => hay.includes(token));
  });
}
