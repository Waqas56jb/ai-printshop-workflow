import { confirmVoice, rejectVoice } from '../../services/today.service.js';
import { formatRelative } from '../../utils/date.js';
import { firstName, quoteTranscript } from '../../utils/format.js';

export function ConfirmQueue({ items, onDone, onError }) {
  if (!items?.length) return null;

  async function confirm(item, payload) {
    try {
      await confirmVoice(item.id, payload);
      onDone(item, 'confirmed');
    } catch (error) {
      onError(error.response?.data?.message || 'Could not confirm');
    }
  }

  async function reject(item) {
    try {
      await rejectVoice(item.id);
      onDone(item, 'rejected');
    } catch (error) {
      onError(error.response?.data?.message || 'Could not reject');
    }
  }

  return (
    <section className="queue">
      <h3>
        Voice commands waiting for you <span className="badge">{items.length}</span>
      </h3>
      {items.map((item) => {
        const kind = item.confirmation?.kind || 'confirm';
        const question = item.confirmation?.question || item.intent?.reply || 'Do this command?';
        const who = firstName(item.user_name || 'Someone');
        return (
          <div className="q" key={item.id}>
            <div>
              <div className="said">{quoteTranscript(item.transcript)}</div>
              <div className="ask">{question}</div>
              <div className="who">
                {who} · {formatRelative(item.created_at)}
              </div>
            </div>
            <div className="opts">
              {kind === 'ambiguous' ? (
                <>
                  {(item.candidates || []).map((job) => (
                    <button key={job.id} type="button" onClick={() => confirm(item, { job_id: job.id })}>
                      {job.job_number} {job.customer_name || job.title}
                    </button>
                  ))}
                  <button type="button" className="no" onClick={() => reject(item)}>
                    Not sure
                  </button>
                </>
              ) : kind === 'skip' ? (
                <>
                  <button type="button" onClick={() => confirm(item, { allow_skip: true })}>
                    Yes, move
                  </button>
                  <button type="button" className="no" onClick={() => reject(item)}>
                    Reject
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => confirm(item, {})}>
                    Yes, do it
                  </button>
                  <button type="button" className="no" onClick={() => reject(item)}>
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
