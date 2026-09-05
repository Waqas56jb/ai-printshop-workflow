import { supabase, unwrap } from '../../config/supabase.js';
import { ApiError } from '../../utils/ApiError.js';
import { emitJobUpdated } from '../../sockets/events.js';
import * as jobsService from '../jobs/jobs.service.js';

const NOTE_SELECT = '*, author:profiles!author_id(id, full_name, email)';

export async function listNotes(jobId) {
  await jobsService.getJobRow(jobId);
  return unwrap(
    await supabase
      .from('job_notes')
      .select(NOTE_SELECT)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false }),
    'Failed to list notes'
  );
}

export async function createNote(jobId, content, userId, source = 'manual') {
  await jobsService.getJobRow(jobId);
  const note = unwrap(
    await supabase
      .from('job_notes')
      .insert({
        job_id: jobId,
        content,
        author_id: userId,
        source,
      })
      .select(NOTE_SELECT)
      .single(),
    'Failed to create note'
  );
  emitJobUpdated({ id: jobId, note });
  return note;
}

export async function deleteNote(id, actor) {
  const note = unwrap(
    await supabase.from('job_notes').select('*').eq('id', id).maybeSingle(),
    'Failed to load note'
  );
  if (!note) {
    throw new ApiError(404, 'Note not found');
  }
  if (actor?.role !== 'admin' && note.author_id !== actor?.id) {
    throw new ApiError(403, 'You can only delete notes you wrote');
  }
  unwrap(await supabase.from('job_notes').delete().eq('id', id), 'Failed to delete note');
  emitJobUpdated({ id: note.job_id, deleted_note_id: id });
  return { id };
}
