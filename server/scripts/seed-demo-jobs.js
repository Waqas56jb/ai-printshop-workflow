import { supabase, unwrap } from '../src/config/supabase.js';
import * as customersService from '../src/modules/customers/customers.service.js';
import * as jobsService from '../src/modules/jobs/jobs.service.js';
import * as stagesService from '../src/modules/stages/stages.service.js';

function isoDays(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

const { data: admin, error: adminError } = await supabase
  .from('profiles')
  .select('id')
  .eq('email', 'admin@printshop.com')
  .maybeSingle();
if (adminError) throw adminError;
const userId = admin?.id || null;

const stages = await stagesService.listStages();
const bySlug = Object.fromEntries(stages.map((stage) => [stage.slug, stage.id]));

const plan = [
  {
    customer: 'Sarah Khan',
    title: '50 T-Shirts',
    product_type: 'T-Shirt',
    quantity: 50,
    stage: 'artwork',
    due: 0,
    priority: 'high',
  },
  {
    customer: 'Metro Gym',
    title: 'Gym banners',
    product_type: 'Banner',
    quantity: 4,
    stage: 'printing',
    due: 0,
    priority: 'urgent',
  },
  {
    customer: 'Ali Hassan',
    title: 'Hoodie restock',
    product_type: 'Hoodie',
    quantity: 12,
    stage: 'approved',
    due: 0,
    priority: 'normal',
  },
  {
    customer: 'Fit Zone',
    title: 'Member flyers',
    product_type: 'Flyer',
    quantity: 500,
    stage: 'quote',
    due: 1,
    priority: 'normal',
  },
  {
    customer: 'Ahmed Raza',
    title: 'Business cards',
    product_type: 'Business card',
    quantity: 200,
    stage: 'qc',
    due: -1,
    priority: 'high',
  },
  {
    customer: 'Fatima Noor',
    title: 'Shop stickers',
    product_type: 'Sticker',
    quantity: 300,
    stage: 'quote',
    due: 5,
    priority: 'low',
  },
];

const existing = unwrap(
  await supabase
    .from('jobs')
    .select('id, job_number, title, due_date, customer:customers!customer_id(name), stage:stages!stage_id(name)')
    .eq('status', 'active'),
  'Failed to list jobs'
);

const created = [];
for (const row of plan) {
  const due = isoDays(row.due);
  const already = (existing || []).find(
    (job) => job.customer?.name === row.customer && job.title === row.title && job.due_date === due
  );
  if (already) {
    created.push({
      job_number: already.job_number,
      customer: row.customer,
      title: row.title,
      stage: already.stage?.name || row.stage,
      due_date: already.due_date,
      quantity: row.quantity,
      product_type: row.product_type,
      reused: true,
    });
    continue;
  }
  const customer = await customersService.findOrCreateByName(row.customer, userId);
  const job = await jobsService.createJob(
    {
      customer_id: customer.id,
      title: row.title,
      product_type: row.product_type,
      quantity: row.quantity,
      stage_id: bySlug[row.stage],
      due_date: due,
      priority: row.priority,
    },
    userId,
    { source: 'manual', silent: true }
  );
  created.push({
    job_number: job.job_number,
    customer: row.customer,
    title: row.title,
    stage: job.stage?.name || row.stage,
    due_date: job.due_date,
    quantity: row.quantity,
    product_type: row.product_type,
  });
}

unwrap({ data: created, error: null }, 'seed');
console.log(JSON.stringify({ today: isoDays(0), jobs: created }, null, 2));
