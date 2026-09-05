export function StaffStats({ stats, users }) {
  const by = stats?.by_role || {};
  const invited = (users || []).find((user) => user.invite_status === 'invited');
  const roleLine = `${by.admin || 0} admin · ${by.staff || 0} staff · ${by.worker || 0} worker`;
  const omiLine = `${stats?.active_last_hour ?? 0} active in the last hour`;
  const doneLine = stats?.top_person
    ? `${stats.top_person.name.split(' ')[0]} leads with ${stats.top_person.count}`
    : 'No jobs completed';
  const inviteLine = invited ? `${invited.full_name.split(' ')[0]} hasn't signed in yet` : 'None pending';

  return (
    <div className="stats">
      <div className="stat">
        <div className="k">People</div>
        <div className="v num">{stats?.total ?? 0}</div>
        <div className="d">{roleLine}</div>
      </div>
      <div className="stat">
        <div className="k">On OMI</div>
        <div className="v num">{stats?.on_omi ?? 0}</div>
        <div className="d">{omiLine}</div>
      </div>
      <div className="stat">
        <div className="k">Jobs done this week</div>
        <div className="v num">{stats?.done_this_week ?? 0}</div>
        <div className="d">{doneLine}</div>
      </div>
      <div className="stat">
        <div className="k">Open invites</div>
        <div className="v num">{stats?.open_invites ?? 0}</div>
        <div className="d">{inviteLine}</div>
      </div>
    </div>
  );
}
