import { z } from 'zod';

export const jobIdParams = z.object({
  id: z.string().uuid(),
});

export const jobListQuery = z.object({
  stage: z.string().uuid().optional(),
  customer: z.string().uuid().optional(),
  assigned: z.union([z.literal('unassigned'), z.string().uuid()]).optional(),
  mine: z.coerce.boolean().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  due_from: z.string().optional(),
  due_to: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function emptyToNull(value) {
  if (value === '' || value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function emptyStringToNull(value) {
  if (value === '' || value === undefined) return null;
  return value;
}

export const createJobBody = z.object({
  customer_id: z.string().uuid(),
  title: z.string().min(1),
  product_type: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  quantity: z.coerce.number().int().positive().optional(),
  print_type: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  size_details: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  price: z.preprocess(emptyToNull, z.number().nullable().optional()),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  stage_id: z.string().uuid().optional(),
  assigned_to: z
    .union([z.string().uuid(), z.literal(''), z.null()])
    .optional()
    .transform((value) => value || null),
  due_date: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  notes: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
});

export const updateJobBody = createJobBody.partial().extend({
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  completed_at: z.string().nullable().optional(),
});

export const moveStageBody = z.object({
  stage_id: z.string().uuid(),
  source: z.enum(['manual', 'voice']).default('manual'),
});

export const assignJobBody = z.object({
  assigned_to: z.string().uuid().nullable(),
});
