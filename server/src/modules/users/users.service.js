import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateTempPassword } from '../../utils/password.js';

function startOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getUser(id) {
  const user = unwrap(
    await supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    'Failed to load user'
  );
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
}

export async function listUsers() {
  const users = unwrap(
    await supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    'Failed to list users'
  ) || [];

  const weekStart = startOfWeek().toISOString();
  const dayStart = startOfDay().toISOString();

  const [jobs, voices, devices] = await Promise.all([
    unwrap(
      await supabase.from('jobs').select('id, assigned_to, status, completed_at'),
      'Failed to load jobs'
    ),
    unwrap(
      await supabase.from('voice_commands').select('id, user_id').gte('created_at', dayStart),
      'Failed to load voice commands'
    ),
    unwrap(
      await supabase.from('omi_devices').select('omi_uid, user_id, last_heard_at'),
      'Failed to load OMI devices'
    ),
  ]);

  const jobsByUser = new Map();
  const doneByUser = new Map();
  for (const job of jobs || []) {
    if (!job.assigned_to) continue;
    if (job.status === 'active') {
      jobsByUser.set(job.assigned_to, (jobsByUser.get(job.assigned_to) || 0) + 1);
    }
    if (job.status === 'completed' && job.completed_at && job.completed_at >= weekStart) {
      doneByUser.set(job.assigned_to, (doneByUser.get(job.assigned_to) || 0) + 1);
    }
  }

  const voiceByUser = new Map();
  for (const row of voices || []) {
    if (!row.user_id) continue;
    voiceByUser.set(row.user_id, (voiceByUser.get(row.user_id) || 0) + 1);
  }

  const deviceByUser = new Map();
  for (const device of devices || []) {
    if (device.user_id) deviceByUser.set(device.user_id, device);
  }

  return users.map((user) => {
    const device = deviceByUser.get(user.id);
    return {
      ...user,
      active_jobs: jobsByUser.get(user.id) || 0,
      done_this_week: doneByUser.get(user.id) || 0,
      voice_today: voiceByUser.get(user.id) || 0,
      omi_last_heard_at: device?.last_heard_at || null,
    };
  });
}

export async function getUserStats() {
  const users = await listUsers();
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const by_role = { admin: 0, staff: 0, worker: 0 };
  let on_omi = 0;
  let active_last_hour = 0;
  let done_this_week = 0;
  let open_invites = 0;
  let top_person = null;

  for (const user of users) {
    by_role[user.role] = (by_role[user.role] || 0) + 1;
    if (user.omi_uid) on_omi += 1;
    if (user.omi_last_heard_at && new Date(user.omi_last_heard_at).getTime() >= hourAgo) {
      active_last_hour += 1;
    }
    done_this_week += user.done_this_week || 0;
    if (user.invite_status === 'invited') open_invites += 1;
    if (!top_person || user.done_this_week > top_person.count) {
      top_person = { name: user.full_name, count: user.done_this_week };
    }
  }

  if (top_person && top_person.count === 0) top_person = null;

  return {
    total: users.length,
    by_role,
    on_omi,
    active_last_hour,
    done_this_week,
    top_person,
    open_invites,
  };
}

export async function assignOmi(id, omiUid) {
  const existing = await getUser(id);
  if (omiUid) {
    unwrap(
      await supabase.from('profiles').update({ omi_uid: null }).eq('omi_uid', omiUid).neq('id', id),
      'Failed to free OMI device'
    );
    unwrap(
      await supabase.from('omi_devices').upsert({
        omi_uid: omiUid,
        user_id: id,
        last_heard_at: new Date().toISOString(),
      }),
      'Failed to assign OMI device'
    );
  } else if (existing.omi_uid) {
    unwrap(
      await supabase.from('omi_devices').update({ user_id: null }).eq('omi_uid', existing.omi_uid),
      'Failed to unassign OMI device'
    );
  }

  unwrap(
    await supabase.from('profiles').update({ omi_uid: omiUid || null }).eq('id', id),
    'Failed to update profile OMI'
  );
}

export async function updateUser(id, payload) {
  const existing = await getUser(id);
  const next = { ...payload };

  if ('omi_uid' in next) {
    await assignOmi(id, next.omi_uid || null);
  }

  if (next.is_active === false && next.invite_status === undefined) {
    next.invite_status = 'inactive';
  }
  if (next.is_active === true && existing.invite_status === 'inactive' && next.invite_status === undefined) {
    next.invite_status = existing.email ? 'active' : 'active';
  }

  return unwrap(
    await supabase.from('profiles').update(next).eq('id', id).select('*').single(),
    'Failed to update user'
  );
}

export async function resetPassword(id, password) {
  const user = await getUser(id);
  if (user.role === 'worker' || !user.email) {
    throw new ApiError(400, 'This person has no login');
  }
  const temp = password || generateTempPassword(user.full_name);
  const { error } = await supabase.auth.admin.updateUserById(id, { password: temp });
  if (error) {
    throw new ApiError(400, error.message);
  }
  return { password: temp };
}

export async function deleteUser(id) {
  await getUser(id);
  unwrap(await supabase.from('profiles').delete().eq('id', id), 'Failed to delete profile');
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error && !/not (found|exist)|user not found/i.test(error.message || '')) {
    throw new ApiError(400, error.message);
  }
  return { id };
}
