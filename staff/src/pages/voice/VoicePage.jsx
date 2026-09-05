import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { OmiStatus } from '../../components/voice/OmiStatus.jsx';
import { VoiceHistory } from '../../components/voice/VoiceHistory.jsx';
import { VoiceTester } from '../../components/voice/VoiceTester.jsx';
import { useSocket } from '../../hooks/useSocket.js';
import { getOmiSetupStatus, listVoiceHistory } from '../../services/dashboard.service.js';
import { listUsers } from '../../services/jobs.service.js';

export default function VoicePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);

  const filterStatus = searchParams.get('status') || '';
  const filterUser = searchParams.get('user') || '';

  const load = useCallback(async () => {
    try {
      const [omi, nextUsers, voice] = await Promise.all([
        getOmiSetupStatus(),
        listUsers(),
        listVoiceHistory({
          page: 1,
          limit: 40,
          status: filterStatus || undefined,
          user: filterUser || undefined,
        }),
      ]);
      setStatus(omi);
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
      <OmiStatus status={status} compact />
      <VoiceTester onRan={load} />
      <VoiceHistory
        items={history}
        users={users}
        status={filterStatus}
        user={filterUser}
        onStatus={(value) => setParam('status', value)}
        onUser={(value) => setParam('user', value)}
        onChanged={load}
      />
    </main>
  );
}
