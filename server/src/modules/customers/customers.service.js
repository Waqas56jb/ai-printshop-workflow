import crypto from 'node:crypto';
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

async function listJobsLite(customerIds) {
  if (customerIds && customerIds.length === 0) return [];
  let query = supabase
    .from('jobs')
    .select(JOB_LITE)
    .order('created_at', { ascending: false })
    .limit(500);
  if (customerIds?.length) query = query.in('customer_id', customerIds);
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
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const q = sanitizeSearch(search);

  // Fast path: SQL pagination — only enrich jobs for the current page
  if (!filter && (sort === 'name' || sort === 'recent')) {
    let query = supabase.from('customers').select('*', { count: 'exact' });
    if (q) {
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`);
    }
    query =
      sort === 'name'
        ? query.order('name', { ascending: true })
        : query.order('created_at', { ascending: false });
    const result = await query.range(from, to);
    const rows = unwrap(result, 'Failed to list customers') || [];
    const jobs = await listJobsLite(rows.map((row) => row.id));
    return {
      items: rows.map((row) => enrichCustomer(row, jobs)),
      page,
      limit,
      total: result.count ?? 0,
    };
  }

  // Active filter: start from active jobs, then page those customers
  if (filter === 'active') {
    const activeJobs =
      unwrap(
        await supabase.from('jobs').select('customer_id').eq('status', 'active'),
        'Failed to load active jobs'
      ) || [];
    let ids = [...new Set(activeJobs.map((row) => row.customer_id).filter(Boolean))];
    if (!ids.length) return { items: [], page, limit, total: 0 };

    let query = supabase.from('customers').select('*', { count: 'exact' }).in('id', ids);
    if (q) {
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`);
    }
    query = query.order(sort === 'name' ? 'name' : 'created_at', { ascending: sort === 'name' });
    const result = await query.range(from, to);
    const rows = unwrap(result, 'Failed to list customers') || [];
    const jobs = await listJobsLite(rows.map((row) => row.id));
    return {
      items: rows.map((row) => enrichCustomer(row, jobs)),
      page,
      limit,
      total: result.count ?? ids.length,
    };
  }

  // Fallback for sort=jobs / filter=none — still avoid loading every completed job forever
  let query = supabase.from('customers').select('*', { count: 'exact' });
  if (q) {
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`);
  }
  const result = await query;
  const rows = unwrap(result, 'Failed to list customers') || [];
  const jobs = await listJobsLite(rows.map((row) => row.id));
  let items = rows.map((row) => enrichCustomer(row, jobs));

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
  items = items.slice(from, from + limit);
  return { items, page, limit, total };
}

export async function getCustomerStats() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [totalResult, newResult, activeJobsResult, customersWithJobs] = await Promise.all([
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString()),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('jobs').select('customer_id, status').in('status', ['active', 'completed']).limit(2000),
  ]);

  const jobRows = unwrap(customersWithJobs, 'Failed to load customer jobs') || [];
  const activeCustomerIds = new Set();
  const deliveredByCustomer = new Map();
  for (const job of jobRows) {
    if (!job.customer_id) continue;
    if (job.status === 'active') activeCustomerIds.add(job.customer_id);
    if (job.status === 'completed') {
      deliveredByCustomer.set(job.customer_id, (deliveredByCustomer.get(job.customer_id) || 0) + 1);
    }
  }
  let repeat = 0;
  for (const count of deliveredByCustomer.values()) {
    if (count >= 2) repeat += 1;
  }
  const total = totalResult.count ?? 0;

  return {
    total,
    new_this_month: newResult.count ?? 0,
    with_active_jobs: activeCustomerIds.size,
    active_jobs_count: activeJobsResult.count ?? 0,
    repeat_percent: total ? Math.round((repeat / total) * 100) : 0,
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

  let artifacts = [];
  try {
    artifacts =
      unwrap(
        await supabase
          .from('customer_artifacts')
          .select('*')
          .eq('customer_id', id)
          .order('folder_path', { ascending: true })
          .order('created_at', { ascending: true }),
        'Failed to load artifacts'
      ) || [];
  } catch {
    artifacts = [];
  }

  return {
    ...customer,
    stats: {
      total_jobs: jobs.length,
      active_jobs: active.length,
      total_spent,
    },
    jobs,
    artifacts,
    share_path: customer.share_token ? `/c/${customer.share_token}` : null,
  };
}

export async function createCustomer(payload, userId) {
  const row = {
    ...payload,
    created_by: userId,
    share_token: crypto.randomBytes(16).toString('hex'),
  };
  if (!String(row.network_folder || '').trim()) {
    const label = String(row.company || row.name || 'CUSTOMER')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase() || 'CUSTOMER';
    row.network_folder = `P:\\CUSTOMER FOLDERS\\${label}`;
  } else {
    row.network_folder = String(row.network_folder).trim().replace(/\\+/g, '\\');
  }
  const first = await supabase.from('customers').insert(row).select('*').single();
  if (first.error && /share_token|network_folder/i.test(first.error.message || '')) {
    if (/share_token/i.test(first.error.message || '')) delete row.share_token;
    if (/network_folder/i.test(first.error.message || '')) delete row.network_folder;
    return unwrap(await supabase.from('customers').insert(row).select('*').single(), 'Failed to create customer');
  }
  return unwrap(first, 'Failed to create customer');
}

export async function updateCustomer(id, payload) {
  await getCustomer(id);
  const allowed = ['name', 'email', 'phone', 'company', 'notes', 'network_folder'];
  const row = {};
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    let value = payload[key];
    if (typeof value === 'string') value = value.trim();
    if (key === 'network_folder' && typeof value === 'string') {
      value = value.replace(/\\+/g, '\\') || null;
    }
    if (value === '') value = null;
    row[key] = value;
  }
  if (!Object.keys(row).length) {
    return getCustomer(id);
  }
  return unwrap(
    await supabase.from('customers').update(row).eq('id', id).select('*').single(),
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
