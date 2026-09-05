import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import { emitBoardRefresh } from '../../sockets/events.js';

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function clearDefaultIfNeeded(isDefault, exceptId) {
  if (!isDefault) return;
  let query = supabase.from('stages').update({ is_default: false }).eq('is_default', true);
  if (exceptId) query = query.neq('id', exceptId);
  unwrap(await query, 'Failed to update default stage');
}

async function clearFinalIfNeeded(isFinal, exceptId) {
  if (!isFinal) return;
  let query = supabase.from('stages').update({ is_final: false }).eq('is_final', true);
  if (exceptId) query = query.neq('id', exceptId);
  unwrap(await query, 'Failed to update final stage');
}

export async function listStages() {
  return unwrap(
    await supabase.from('stages').select('*').order('position', { ascending: true }),
    'Failed to list stages'
  );
}

export async function getStage(id) {
  const stage = unwrap(
    await supabase.from('stages').select('*').eq('id', id).maybeSingle(),
    'Failed to load stage'
  );
  if (!stage) {
    throw new ApiError(404, 'Stage not found');
  }
  return stage;
}

export async function getDefaultStage() {
  const stage = unwrap(
    await supabase.from('stages').select('*').eq('is_default', true).maybeSingle(),
    'Failed to load default stage'
  );
  if (stage) return stage;
  const stages = await listStages();
  if (!stages.length) {
    throw new ApiError(400, 'No stages configured');
  }
  return stages[0];
}

export async function getFinalStage() {
  return unwrap(
    await supabase.from('stages').select('*').eq('is_final', true).maybeSingle(),
    'Failed to load final stage'
  );
}

function stageAliases(stage) {
  return (stage.aliases || []).map((alias) => String(alias).toLowerCase().trim()).filter(Boolean);
}

export async function findStageByName(name) {
  if (!name) return null;
  const stages = await listStages();
  const q = name.toLowerCase().trim();
  return (
    stages.find((s) => s.slug === q || s.name.toLowerCase() === q) ||
    stages.find((s) => stageAliases(s).includes(q)) ||
    stages.find((s) => stageAliases(s).some((alias) => q.includes(alias) || alias.includes(q))) ||
    stages.find((s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())) ||
    null
  );
}

export async function createStage(payload) {
  const existing = await listStages();
  const position = payload.position ?? existing.length + 1;
  const slug = payload.slug || slugify(payload.name);
  await clearDefaultIfNeeded(payload.is_default);
  await clearFinalIfNeeded(payload.is_final);

  const created = unwrap(
    await supabase
      .from('stages')
      .insert({
        name: payload.name,
        slug,
        color: payload.color || '#6366f1',
        position,
        is_default: Boolean(payload.is_default),
        is_final: Boolean(payload.is_final),
        aliases: payload.aliases || [slugify(payload.name)],
        show_on_board: payload.show_on_board !== false,
      })
      .select('*')
      .single(),
    'Failed to create stage'
  );
  emitBoardRefresh();
  return created;
}

export async function updateStage(id, payload) {
  await getStage(id);
  const next = { ...payload };
  if (payload.name && !payload.slug) {
    next.slug = slugify(payload.name);
  }
  await clearDefaultIfNeeded(payload.is_default, id);
  await clearFinalIfNeeded(payload.is_final, id);
  const updated = unwrap(
    await supabase.from('stages').update(next).eq('id', id).select('*').single(),
    'Failed to update stage'
  );
  emitBoardRefresh();
  return updated;
}

export async function deleteStage(id) {
  await getStage(id);
  const active = unwrap(
    await supabase.from('jobs').select('id').eq('stage_id', id).eq('status', 'active'),
    'Failed to check stage jobs'
  );
  if (active?.length) {
    throw new ApiError(
      409,
      `This stage has ${active.length} active job${active.length === 1 ? '' : 's'} and cannot be deleted`
    );
  }
  const jobs = unwrap(
    await supabase.from('jobs').select('id').eq('stage_id', id).limit(1),
    'Failed to check stage jobs'
  );
  if (jobs?.length) {
    throw new ApiError(409, 'This stage has jobs and cannot be deleted');
  }
  unwrap(await supabase.from('stages').delete().eq('id', id), 'Failed to delete stage');
  emitBoardRefresh();
  return { id };
}

export async function reorderStages(ids) {
  const updates = ids.map((id, index) =>
    supabase.from('stages').update({ position: index + 1 }).eq('id', id)
  );
  const results = await Promise.all(updates);
  results.forEach((result) => unwrap(result, 'Failed to reorder stages'));
  emitBoardRefresh();
  return listStages();
}
