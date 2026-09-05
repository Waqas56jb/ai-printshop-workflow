import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { OmiDevices } from '../../components/voice/OmiDevices.jsx';
import { OmiSetup } from '../../components/voice/OmiSetup.jsx';
import { OmiStatus } from '../../components/voice/OmiStatus.jsx';
import { VoiceHistory } from '../../components/voice/VoiceHistory.jsx';
import { VoiceSettings } from '../../components/voice/VoiceSettings.jsx';
import { OmiDebugFeed } from '../../components/voice/OmiDebugFeed.jsx';
import { VoiceTester } from '../../components/voice/VoiceTester.jsx';
import { useSocket } from '../../hooks/useSocket.js';
import { getOmiSetupStatus, getSettings, listVoiceHistory } from '../../services/dashboard.service.js';
import { listUsers } from '../../services/jobs.service.js';

export default function VoicePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);

  const filterStatus = searchParams.get('status') || '';
  const filterUser = searchParams.get('user') || '';

  const load = useCallback(async () => {
    try {
      const [omi, nextSettings, nextUsers, voice] = await Promise.all([
        getOmiSetupStatus(),
        getSettings(),
        listUsers(),
        listVoiceHistory({
          page: 1,
          limit: 30,
          status: filterStatus || undefined,
          user: filterUser || undefined,
        }),
      ]);
      setStatus(omi);
      setSettings(nextSettings);
      setUsers(nextUsers || []);
      setHistory(voice.items || []);
    } catch (error) {
      toast(error.response?.data?.message || 'Failed to load voice page');
    }
  }, [filterStatus, filterUser]);

  useEffect(() => {
    load();
  }, [load]);

  const onLive = useCallback(() => {
    load();
  }, [load]);
  useSocket(onLive);

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  }

  return (
    <main className="sv-page">
      <div className="intro">
        <div>
          <h2>Voice &amp; OMI</h2>
          <p>Workers wear an OMI device. What they say is sent here, understood, and turned into job actions.</p>
        </div>
      </div>

      <div className="grid2">
        <div className="col">
          <OmiStatus status={status} />
          <OmiSetup maskedUrl={status?.webhook_url} />
          <OmiDevices devices={status?.devices || []} users={users} onChanged={load} />
        </div>
        <div className="col">
          {settings ? <VoiceSettings settings={settings} onChanged={load} /> : <div className="skel" />}
          <VoiceTester onRan={load} />
        </div>
      </div>

      <VoiceHistory
        items={history}
        users={users}
        status={filterStatus}
        user={filterUser}
        onStatus={(value) => setParam('status', value)}
        onUser={(value) => setParam('user', value)}
        onChanged={load}
      />
      <OmiDebugFeed refreshKey={history.length} />
    </main>
  );
}
