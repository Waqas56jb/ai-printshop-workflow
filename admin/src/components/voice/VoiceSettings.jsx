import { toast } from 'sonner';
import { updateSettings } from '../../services/dashboard.service.js';

export function VoiceSettings({ settings = {}, onChanged }) {
  async function save(patch) {
    try {
      await updateSettings(patch);
      toast('Saved');
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not save settings');
    }
  }

  const threshold = Math.round(Number(settings.voice_confidence_threshold ?? 0.7) * 100);

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>How commands are handled</h3>
      </div>
      <div className="setting">
        <div className="t">
          <b>Run commands automatically</b>
          <span>Off = every command waits for a staff confirmation</span>
        </div>
        <span
          className={`toggle ${settings.voice_auto_execute !== false ? 'on' : ''}`.trim()}
          onClick={() => save({ voice_auto_execute: settings.voice_auto_execute === false })}
        />
      </div>
      <div className="setting">
        <div className="t">
          <b>Ask before acting when unsure</b>
          <span>Below this confidence, the command goes to the confirmation queue</span>
        </div>
        <label className="field" style={{ width: 110 }}>
          <input
            defaultValue={`${threshold}%`}
            onBlur={(event) => {
              const n = Number(String(event.target.value).replace('%', ''));
              if (Number.isNaN(n)) return;
              save({ voice_confidence_threshold: Math.min(1, Math.max(0, n / 100)) });
            }}
          />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Wake phrase</b>
          <span>Only react when a sentence starts with this. Leave empty to listen to everything.</span>
        </div>
        <label className="field">
          <input
            defaultValue={settings.voice_trigger_word || ''}
            placeholder="e.g. Hey shop"
            onBlur={(event) => save({ voice_trigger_word: event.target.value })}
          />
        </label>
      </div>
      <div className="setting">
        <div className="t">
          <b>Reply on the device</b>
          <span>Send a short confirmation back to the OMI app</span>
        </div>
        <span
          className={`toggle ${settings.voice_reply_on_device !== false ? 'on' : ''}`.trim()}
          onClick={() => save({ voice_reply_on_device: settings.voice_reply_on_device === false })}
        />
      </div>
      <div className="setting">
        <div className="t">
          <b>Language</b>
          <span>What workers speak</span>
        </div>
        <label className="field">
          <select
            value={settings.voice_language || 'auto'}
            onChange={(event) => save({ voice_language: event.target.value })}
          >
            <option value="auto">English + Urdu (auto)</option>
            <option value="en">English</option>
            <option value="ur">Urdu</option>
          </select>
        </label>
      </div>
    </section>
  );
}
