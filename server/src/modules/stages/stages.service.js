import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import { emitBoardRefresh } from '../../sockets/events.js';

// Stage edits change what the TV shows and what voice can match, right away.
async function stagesChanged() {
  await normalizeEnds();
  emitBoardRefresh();
  // Lazy import: the voice module imports this one.
  import('../voice/intent.service.js')
    .then((module) => module.invalidateIntentContext())
    .catch(() => {});
}

// Plain rules for the owner: the first stage is where new jobs start, the last
// stage completes the job. Kept in sync after every edit.
async function normalizeEnds() {
  const stages = await listStages();
  const lastIndex = stages.length - 1;
  const updates = stages
    .map((stage, index) => ({ stage, is_default: index === 0, is_final: index === lastIndex }))
    .filter(({ stage, is_default, is_final }) => stage.is_default !== is_default || stage.is_final !== is_final)
    .map(({ stage, is_default, is_final }) =>
      supabase.from('stages').update({ is_default, is_final }).eq('id', stage.id)
    );
  const results = await Promise.all(updates);
  results.forEach((result) => unwrap(result, 'Failed to update first/last stage'));
}

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
  const name = payload.name.trim();
  if (existing.some((stage) => stage.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, `There is already a stage called ${name}`);
  }
  const position = payload.position ?? existing.length + 1;
  const slug = payload.slug || slugify(name);
  await clearDefaultIfNeeded(payload.is_default);
  await clearFinalIfNeeded(payload.is_final);

  const created = unwrap(
    await supabase
      .from('stages')
      .insert({
        name,
        slug,
        color: payload.color || '#6366f1',
        position,
        is_default: Boolean(payload.is_default),
        is_final: Boolean(payload.is_final),
        aliases: payload.aliases || [name.toLowerCase()],
        show_on_board: payload.show_on_board !== false,
      })
      .select('*')
      .single(),
    'Failed to create stage'
  );
  if (payload.position == null && existing.length) {
    // A new stage goes just before the last one, so the "done" stage stays last.
    const ids = existing.map((stage) => stage.id);
    ids.splice(ids.length - 1, 0, created.id);
    await reorderStages(ids);
  } else {
    await stagesChanged();
  }
  return getStage(created.id);
}

export async function updateStage(id, payload) {
  await getStage(id);
  const next = { ...payload };
  if (payload.name) {
    next.name = payload.name.trim();
    const others = (await listStages()).filter((stage) => stage.id !== id);
    if (others.some((stage) => stage.name.trim().toLowerCase() === next.name.toLowerCase())) {
      throw new ApiError(409, `There is already a stage called ${next.name}`);
    }
  }
  if (next.name && !payload.slug) {
    next.slug = slugify(next.name);
  }
  await clearDefaultIfNeeded(payload.is_default, id);
  await clearFinalIfNeeded(payload.is_final, id);
  const updated = unwrap(
    await supabase.from('stages').update(next).eq('id', id).select('*').single(),
    'Failed to update stage'
  );
  await stagesChanged();
  return updated;
}

export async function deleteStage(id) {
  const stage = await getStage(id);
  const active = unwrap(
    await supabase.from('jobs').select('id').eq('stage_id', id).eq('status', 'active'),
    'Failed to check stage jobs'
  );
  if (active?.length) {
    const n = active.length;
    throw new ApiError(409, `Move the ${n} job${n === 1 ? '' : 's'} out of ${stage.name} first`);
  }
  const remaining = (await listStages()).filter((item) => item.id !== id);
  if (!remaining.length) {
    throw new ApiError(409, 'The shop needs at least one stage');
  }
  // Finished (or cancelled) jobs still point at this stage — park them on the
  // last stage. Their "moved to <this stage>" history lines go with the stage.
  unwrap(
    await supabase
      .from('jobs')
      .update({ stage_id: remaining[remaining.length - 1].id })
      .eq('stage_id', id),
    'Failed to move finished jobs off the stage'
  );
  unwrap(
    await supabase.from('job_stage_history').delete().eq('to_stage_id', id),
    'Failed to clear stage history'
  );
  unwrap(await supabase.from('stages').delete().eq('id', id), 'Failed to delete stage');
  await reorderStages(remaining.map((item) => item.id));
  return { id };
}

export async function reorderStages(ids) {
  const updates = ids.map((id, index) =>
    supabase.from('stages').update({ position: index + 1 }).eq('id', id)
  );
  const results = await Promise.all(updates);
  results.forEach((result) => unwrap(result, 'Failed to reorder stages'));
  await stagesChanged();
  return listStages();
}
