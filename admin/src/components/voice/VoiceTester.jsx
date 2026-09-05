import { useState } from 'react';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button.jsx';
import { confirmVoice, rejectVoice, sendVoiceCommand } from '../../services/dashboard.service.js';

const EXAMPLES = [
  "what's due today",
  'add note to the gym job: white ink',
  'new job for Café Nine, 120 menu cards, due Monday',
  'where is J-1019',
];

export function VoiceTester({ onRan }) {
  const [text, setText] = useState("move sarah's job to printing");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function run(transcript = text) {
    const said = transcript.trim();
    if (!said) return;
    setBusy(true);
    try {
      const response = await sendVoiceCommand(said);
      setResult(response);
      onRan?.();
    } catch (error) {
      toast(error.response?.data?.message || 'Command failed');
    } finally {
      setBusy(false);
    }
  }

  const payload = result?.data || result;
  const command = payload?.command;
  const intent = command?.intent || {};
  const action = command?.action || intent.action;
  const confidence = intent.confidence;
  const pending = payload?.needs_confirmation || command?.status === 'pending_confirmation';

  async function confirm() {
    await confirmVoice(command.id);
    toast('Command confirmed');
    onRan?.();
    setResult(null);
  }

  async function reject() {
    await rejectVoice(command.id);
    toast('Command rejected');
    onRan?.();
    setResult(null);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Try a command</h3>
        <p>Runs for real, logged as you</p>
      </div>
      <div className="tester">
        <label className="field">
          <Mic />
          <input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && run()} />
          <Button className="btn-sm" onClick={() => run()} disabled={busy}>
            Run
          </Button>
        </label>
        <div className="chips">
          {EXAMPLES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setText(item);
                run(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        {result ? (
          <div className="result">
            <div className="r1">
              <span>
                {payload?.ignored ? 'Ignored' : (
                  <>
                    Understood as <b>{action || 'unknown'}</b>
                  </>
                )}
              </span>
              {confidence != null ? (
                <span className="conf">
                  confidence <i style={{ '--w': `${Math.round(confidence * 100)}%` }} /> {Number(confidence).toFixed(2)}
                </span>
              ) : null}
            </div>
            <pre>
              {intent.job_ref ? `job_ref: "${intent.job_ref}"` : 'job_ref: —'}
              {intent.stage ? `\nstage:   "${intent.stage}"` : ''}
              {intent.note ? `\nnote:    "${intent.note}"` : ''}
              {intent.customer_name ? `\ncustomer: "${intent.customer_name}"` : ''}
              {command?.error ? `\nerror:   ${command.error}` : ''}
            </pre>
            <div className="reply">{result.message || payload?.message || 'Done.'}</div>
            {pending && command?.id ? (
              <div className="side-foot" style={{ borderTop: '1px solid var(--rule-2)', padding: '10px 14px' }}>
                <Button className="btn-sm" onClick={confirm}>
                  Confirm
                </Button>
                <Button variant="ghost" className="btn-sm" onClick={reject}>
                  Reject
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
