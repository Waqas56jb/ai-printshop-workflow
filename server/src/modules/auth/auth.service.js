import { randomUUID } from 'node:crypto';
import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import * as usersService from '../users/users.service.js';

export async function getMe(userId) {
  const profile = unwrap(
    await supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    'Failed to load profile'
  );
  if (!profile) {
    throw new ApiError(404, 'Profile not found');
  }
  return profile;
}

export async function registerStaff({ email, password, full_name, role, omi_uid, job_title }) {
  if (role === 'worker') {
    const id = randomUUID();
    const profile = unwrap(
      await supabase
        .from('profiles')
        .insert({
          id,
          email: email || null,
          full_name,
          role: 'worker',
          job_title: job_title || null,
          omi_uid: null,
          is_active: true,
          invite_status: 'active',
        })
        .select('*')
        .single(),
      'Failed to create worker'
    );
    if (omi_uid) {
      await usersService.assignOmi(profile.id, omi_uid);
      return usersService.getUser(profile.id);
    }
    return profile;
  }

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (error || !data?.user) {
    throw new ApiError(400, error?.message || 'Failed to create user');
  }

  const profile = unwrap(
    await supabase
      .from('profiles')
      .upsert(
        {
          id: data.user.id,
          email,
          full_name,
          role,
          job_title: job_title || null,
          omi_uid: omi_uid || null,
          is_active: true,
          invite_status: 'invited',
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single(),
    'Failed to create profile'
  );

  if (omi_uid) {
    await usersService.assignOmi(profile.id, omi_uid);
  }

  return profile;
}

export async function updateMe(userId, { full_name, email }) {
  const patch = {};
  if (full_name !== undefined) patch.full_name = full_name;
  if (email !== undefined) {
    patch.email = email;
    const { error } = await supabase.auth.admin.updateUserById(userId, { email });
    if (error) {
      throw new ApiError(400, error.message);
    }
  }
  if (!Object.keys(patch).length) {
    return getMe(userId);
  }
  return unwrap(
    await supabase.from('profiles').update(patch).eq('id', userId).select('*').single(),
    'Failed to update profile'
  );
}

export async function changePassword(userId, { current_password, new_password }) {
  const profile = await getMe(userId);
  if (!profile.email) {
    throw new ApiError(400, 'This account has no email login');
  }
  const { error: signError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: current_password,
  });
  if (signError) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  const { error } = await supabase.auth.admin.updateUserById(userId, { password: new_password });
  if (error) {
    throw new ApiError(400, error.message);
  }
  return { ok: true };
}

export async function signOutEverywhere(userId) {
  const { error } = await supabase.auth.admin.signOut(userId);
  if (error && !/not (found|exist)/i.test(error.message || '')) {
    throw new ApiError(400, error.message);
  }
  return { ok: true };
}
