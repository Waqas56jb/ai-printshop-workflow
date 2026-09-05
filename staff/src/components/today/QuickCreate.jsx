import { useState } from 'react';
import { Plus } from 'lucide-react';
import { parseJob } from '../../services/jobs.service.js';

export function QuickCreate({ onFullForm, onParsed, onError }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate(event) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = await parseJob(text.trim());
      onParsed(parsed);
      setText('');
    } catch (error) {
      onError(error.response?.data?.message || 'Could not parse that line');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Quick job</h3>
        <button type="button" className="link" onClick={onFullForm}>
          Full form
        </button>
      </div>
      <form className="quick" onSubmit={handleCreate}>
        <div className="row">
          <label className="field">
            <Plus />
            <input
              placeholder="Sarah Khan, 50 t-shirts, due Friday"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-ink" disabled={busy}>
            {busy ? 'Reading…' : 'Create'}
          </button>
        </div>
        <div className="hint">
          Type it like you'd say it — <b>customer, what, how many, when</b>. We fill the form; you confirm.
        </div>
      </form>
    </section>
  );
}
