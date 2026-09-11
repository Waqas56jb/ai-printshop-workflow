import { supabase, unwrap } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const profileCache = new Map();
const PROFILE_TTL_MS = 30_000;

function readBearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

function cacheKey(token) {
  return token.length > 48 ? `${token.slice(0, 24)}:${token.slice(-24)}` : token;
}

function getCachedProfile(token) {
  const row = profileCache.get(cacheKey(token));
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    profileCache.delete(cacheKey(token));
    return null;
  }
  return row;
}

function setCachedProfile(token, user, profile) {
  profileCache.set(cacheKey(token), {
    user,
    profile,
    expiresAt: Date.now() + PROFILE_TTL_MS,
  });
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = readBearer(req);
  if (!token) {
    throw new ApiError(401, 'Missing Authorization bearer token');
  }

  const cached = getCachedProfile(token);
  if (cached?.profile?.is_active) {
    touchLastActive(cached.profile);
    req.user = {
      id: cached.user.id,
      email: cached.user.email,
      role: cached.profile.role,
      profile: cached.profile,
    };
    return next();
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const profile = unwrap(
    await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, invite_status, last_active_at, job_title')
      .eq('id', data.user.id)
      .maybeSingle(),
    'Failed to load profile'
  );

  if (!profile) {
    throw new ApiError(403, 'Profile not found');
  }

  if (!profile.is_active) {
    throw new ApiError(403, 'Account is inactive');
  }

  setCachedProfile(token, data.user, profile);
  touchLastActive(profile);

  req.user = {
    id: data.user.id,
    email: data.user.email,
    role: profile.role,
    profile,
  };

  next();
});

export async function optionalUser(req) {
  const token = readBearer(req);
  if (!token) return null;
  const cached = getCachedProfile(token);
  if (cached?.profile?.is_active) return cached.profile;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  const profile = unwrap(
    await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, invite_status, last_active_at, job_title')
      .eq('id', data.user.id)
      .maybeSingle(),
    'Failed to load profile'
  );
  if (!profile?.is_active) return null;
  setCachedProfile(token, data.user, profile);
  return profile;
}

function touchLastActive(profile) {
  const patch = {};
  if (profile.invite_status === 'invited') {
    patch.invite_status = 'active';
  }
  const last = profile.last_active_at ? new Date(profile.last_active_at).getTime() : 0;
  if (!last || Date.now() - last > 5 * 60 * 1000) {
    patch.last_active_at = new Date().toISOString();
  }
  if (!Object.keys(patch).length) return;
  supabase
    .from('profiles')
    .update(patch)
    .eq('id', profile.id)
    .then(({ error }) => {
      if (error) console.warn('Failed to update last_active_at', error.message);
    });
}
