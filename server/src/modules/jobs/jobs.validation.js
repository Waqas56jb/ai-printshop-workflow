import { z } from 'zod';

export const jobIdParams = z.object({
  id: z.string().uuid(),
});

export const jobListQuery = z.object({
  stage: z.string().uuid().optional(),
  customer: z.string().uuid().optional(),
  assigned: z.union([z.literal('unassigned'), z.string().uuid()]).optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  due_from: z.string().optional(),
  due_to: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createJobBody = z.object({
  customer_id: z.string().uuid(),
  title: z.string().min(1),
  product_type: z.string().nullable().optional(),
  quantity: z.number().int().positive().default(1),
  print_type: z.string().nullable().optional(),
  size_details: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  stage_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateJobBody = createJobBody.partial().extend({
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
});

export const moveStageBody = z.object({
  stage_id: z.string().uuid(),
  source: z.enum(['manual', 'voice']).default('manual'),
});

export const assignJobBody = z.object({
  assigned_to: z.string().uuid().nullable(),
});
