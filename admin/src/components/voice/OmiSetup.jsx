import { useState } from 'react';
import { toast } from 'sonner';
import { getOmiWebhookUrl } from '../../services/dashboard.service.js';

export function OmiSetup({ maskedUrl }) {
  const [busy, setBusy] = useState(false);

  async function copy() {
    setBusy(true);
    try {
      const data = await getOmiWebhookUrl();
      await navigator.clipboard.writeText(data.url);
      toast('Webhook URL copied');
    } catch (error) {
      toast(error.response?.data?.message || 'Could not copy webhook URL');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Connect a new OMI device</h3>
      </div>
      <div className="setup">
        <div className="step">
          <span className="n">1</span>
          <div>
            <b>Pair the device</b>
            <p>Install the OMI app on the worker's phone and pair the wearable over Bluetooth.</p>
          </div>
        </div>
        <div className="step">
          <span className="n">2</span>
          <div>
            <b>Create the app inside OMI</b>
            <p>
              OMI app → Explore → Create an App → capability <b style={{ display: 'inline' }}>Real-time transcript</b>.
              Paste this webhook URL, then install it.
            </p>
            <div className="copy">
              <span>{maskedUrl || 'https://…/api/omi/webhook?secret=••••'}</span>
              <button type="button" onClick={copy} disabled={busy}>
                Copy
              </button>
            </div>
          </div>
        </div>
        <div className="step">
          <span className="n">3</span>
          <div>
            <b>Say something</b>
            <p>The device appears below as "New". Assign it to the worker so actions are logged under their name.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
