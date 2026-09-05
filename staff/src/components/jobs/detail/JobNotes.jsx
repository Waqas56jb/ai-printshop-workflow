import { useState } from 'react';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '../../ui/Avatar.jsx';
import { Button } from '../../ui/Button.jsx';
import { createNote, deleteNote } from '../../../services/jobs.service.js';
import { formatDayTime } from '../../../utils/date.js';

export function JobNotes({ job, currentUserId, onChanged }) {
  const [text, setText] = useState('');
  const notes = [...(job.notes || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  async function submit() {
    const body = text.trim();
    if (!body) return;
    try {
      await createNote(job.id, body);
      setText('');
      toast('Note added');
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not add note');
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this note?')) return;
    try {
      await deleteNote(id);
      toast('Note deleted');
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not delete note');
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>
          Notes <span className="sub">{notes.length}</span>
        </h3>
      </div>
      {notes.map((note) => (
        <div className="note" key={note.id}>
          <Avatar name={note.author?.full_name} />
          <div>
            <div className="who">
              <b>{note.author?.full_name || 'Staff'}</b> · {formatDayTime(note.created_at)}
              {note.source === 'voice' ? (
                <span className="voice">
                  <Mic />
                  voice
                </span>
              ) : null}
            </div>
            <p>{note.content}</p>
          </div>
          {note.author_id === currentUserId || note.author?.id === currentUserId ? (
            <button type="button" className="del" onClick={() => remove(note.id)}>
              Delete
            </button>
          ) : null}
        </div>
      ))}
      <div className="compose">
        <textarea
          placeholder="Add a note…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submit();
          }}
        />
        <Button onClick={submit}>Add</Button>
      </div>
    </section>
  );
}
