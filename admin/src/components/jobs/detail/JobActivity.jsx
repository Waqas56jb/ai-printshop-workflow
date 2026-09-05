import { formatDayTime } from '../../../utils/date.js';

function voiceAction(cmd) {
  return cmd.action || cmd.intent?.action || '';
}

function speakerName(cmd, users) {
  return (
    cmd.speaker_name ||
    cmd.user?.full_name ||
    users.find((user) => user.id === cmd.user_id)?.full_name ||
    ''
  );
}

function nearestVoice(commands, at, action) {
  const target = new Date(at).getTime();
  return commands
    .filter((cmd) => voiceAction(cmd) === action)
    .map((cmd) => ({ cmd, dist: Math.abs(new Date(cmd.created_at).getTime() - target) }))
    .filter((row) => row.dist < 5 * 60 * 1000)
    .sort((a, b) => a.dist - b.dist)[0]?.cmd;
}

export function JobActivity({ job, voiceCommands = [], users = [] }) {
  const usedVoice = new Set();
  const items = [];
  const creator = users.find((user) => user.id === job.created_by);

  items.push({
    id: `created-${job.id}`,
    at: job.created_at,
    voice: false,
    title: 'Job created',
    by: creator?.full_name || '',
  });

  (job.history || [])
    .filter((row) => row.from_stage_id)
    .forEach((row) => {
      const fromName = row.from_stage?.name || '';
      const toName = row.to_stage?.name || '';
      const voice = row.source === 'voice';
      const matched = voice ? nearestVoice(voiceCommands, row.created_at, 'move_stage') : null;
      if (matched) usedVoice.add(matched.id);
      items.push({
        id: row.id,
        at: row.created_at,
        voice,
        title: fromName && toName ? `${fromName} → ${toName}` : toName || 'Stage changed',
        by: row.changed_by_profile?.full_name,
        source: voice ? 'voice' : null,
        quote: matched?.transcript || null,
      });
    });

  (job.artworks || []).forEach((art) => {
    if (art.is_approved) {
      items.push({
        id: `art-${art.id}`,
        at: art.approved_at || art.updated_at || art.created_at,
        voice: false,
        title: `Artwork v${art.version} approved`,
        by: users.find((user) => user.id === art.approved_by)?.full_name || '',
      });
    }
  });

  voiceCommands.forEach((cmd) => {
    if (usedVoice.has(cmd.id)) return;
    const action = voiceAction(cmd);
    if (action === 'move_stage' || action === 'job_status' || action === 'due_today' || action === 'pending_jobs') {
      return;
    }
    items.push({
      id: cmd.id,
      at: cmd.created_at,
      voice: true,
      title: action === 'add_note' ? 'Note added' : action ? action.replace(/_/g, ' ') : 'Voice command',
      by: speakerName(cmd, users),
      source: 'voice',
      quote: action === 'add_note' ? null : cmd.transcript,
    });
  });

  const ordered = items.sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Activity</h3>
      </div>
      {ordered.map((item) => (
        <div className="act" key={item.id}>
          <div className="ln">
            <i className={item.voice ? 'm' : ''} />
          </div>
          <div className="tx">
            <b>{item.title}</b>
            {item.by ? ` by ${item.by}` : ''}
            {item.source === 'voice' ? ' via voice' : ''}
            {item.quote ? (
              <>
                <br />
                <q>{item.quote}</q>
              </>
            ) : null}
            <span>{formatDayTime(item.at)}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
