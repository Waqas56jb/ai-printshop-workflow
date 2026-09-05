import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';

const JOB_LITE = `
  id, job_number, title, status, price, created_at, updated_at, due_date, customer_id,
  stage:stages!stage_id(id, name, color, is_final)
`;

function sanitizeSearch(value) {
  return (value || '').replace(/[%_,.()]/g, ' ').trim();
}

function isActive(job) {
  return job.status === 'active';
}

function isDelivered(job) {
  return job.status === 'completed' || Boolean(job.stage?.is_final);
}

async function listJobsLite(customerIds) {
  let query = supabase.from('jobs').select(JOB_LITE).order('created_at', { ascending: false });
  if (customerIds?.length) query = query.in('customer_id', customerIds);
  if (customerIds && customerIds.length === 0) return [];
  return unwrap(await query, 'Failed to load customer jobs') || [];
}

function enrichCustomer(customer, jobs) {
  const mine = jobs.filter((job) => job.customer_id === customer.id);
  const active = mine.filter(isActive);
  const last = mine[0] || null;
  return {
    ...customer,
    total_jobs: mine.length,
    active_jobs: active.map((job) => ({
      job_id: job.id,
      job_number: job.job_number,
      stage_name: job.stage?.name || null,
      stage_color: job.stage?.color || '#8A93A1',
    })),
    last_job_at: last?.created_at || null,
  };
}

export async function listCustomers({ search, filter, sort = 'recent', page = 1, limit = 20 }) {
  let query = supabase.from('customers').select('*', { count: 'exact' });

  const q = sanitizeSearch(search);
  if (q) {
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`);
  }

  const result = await query;
  const rows = unwrap(result, 'Failed to list customers') || [];
  const jobs = await listJobsLite(rows.map((row) => row.id));
  let items = rows.map((row) => enrichCustomer(row, jobs));

  if (filter === 'active') items = items.filter((item) => item.active_jobs.length > 0);
  if (filter === 'none') items = items.filter((item) => item.total_jobs === 0);

  if (sort === 'name') {
    items.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'jobs') {
    items.sort((a, b) => b.total_jobs - a.total_jobs || a.name.localeCompare(b.name));
  } else {
    items.sort((a, b) => {
      const aTime = new Date(a.last_job_at || a.created_at).getTime();
      const bTime = new Date(b.last_job_at || b.created_at).getTime();
      return bTime - aTime;
    });
  }

  const total = items.length;
  const from = (page - 1) * limit;
  items = items.slice(from, from + limit);

  return { items, page, limit, total };
}

export async function getCustomerStats() {
  const customers = unwrap(await supabase.from('customers').select('id, created_at'), 'Failed to load customers') || [];
  const jobs = await listJobsLite(customers.map((row) => row.id));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const byCustomer = new Map(customers.map((row) => [row.id, []]));
  jobs.forEach((job) => {
    if (!byCustomer.has(job.customer_id)) byCustomer.set(job.customer_id, []);
    byCustomer.get(job.customer_id).push(job);
  });

  let withActive = 0;
  let repeat = 0;
  customers.forEach((row) => {
    const mine = byCustomer.get(row.id) || [];
    if (mine.some(isActive)) withActive += 1;
    if (mine.filter(isDelivered).length >= 2) repeat += 1;
  });

  return {
    total: customers.length,
    new_this_month: customers.filter((row) => new Date(row.created_at) >= monthStart).length,
    with_active_jobs: withActive,
    active_jobs_count: jobs.filter(isActive).length,
    repeat_percent: customers.length ? Math.round((repeat / customers.length) * 100) : 0,
  };
}

export async function getCustomer(id) {
  const customer = unwrap(
    await supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    'Failed to load customer'
  );
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  return customer;
}

export async function getCustomerDetail(id) {
  const customer = await getCustomer(id);
  const jobs = unwrap(
    await supabase.from('jobs').select(JOB_LITE).eq('customer_id', id).order('created_at', { ascending: false }),
    'Failed to load customer jobs'
  ) || [];
  const active = jobs.filter(isActive);
  const total_spent = jobs.reduce((sum, job) => sum + Number(job.price || 0), 0);

  return {
    ...customer,
    stats: {
      total_jobs: jobs.length,
      active_jobs: active.length,
      total_spent,
    },
    jobs,
  };
}

export async function createCustomer(payload, userId) {
  return unwrap(
    await supabase
      .from('customers')
      .insert({ ...payload, created_by: userId })
      .select('*')
      .single(),
    'Failed to create customer'
  );
}

export async function updateCustomer(id, payload) {
  await getCustomer(id);
  return unwrap(
    await supabase.from('customers').update(payload).eq('id', id).select('*').single(),
    'Failed to update customer'
  );
}

export async function deleteCustomer(id) {
  await getCustomer(id);
  const jobs = unwrap(
    await supabase.from('jobs').select('id, status').eq('customer_id', id),
    'Failed to check customer jobs'
  ) || [];
  if (jobs.length) {
    const active = jobs.filter((job) => job.status === 'active').length;
    if (active) {
      throw new ApiError(409, `This customer has ${active} active job${active === 1 ? '' : 's'} and cannot be deleted`);
    }
    throw new ApiError(409, 'This customer has jobs and cannot be deleted');
  }
  unwrap(await supabase.from('customers').delete().eq('id', id), 'Failed to delete customer');
  return { id };
}

export async function findOrCreateByName(name, userId) {
  const trimmed = name.trim();
  const existing = unwrap(
    await supabase.from('customers').select('*').ilike('name', trimmed).limit(1),
    'Failed to search customers'
  );
  if (existing?.[0]) return existing[0];
  return createCustomer({ name: trimmed }, userId);
}
