import { Avatar } from '../ui/Avatar.jsx';
import { Panel } from '../ui/Panel.jsx';

export function StaffWorkload({ staff = [] }) {
  return (
    <Panel title="Staff workload" actionTo="/staff" actionLabel="Manage">
      {staff.length === 0 ? (
        <div className="empty">
          <p>No staff activity this week.</p>
        </div>
      ) : (
        staff.map((row, index) => (
          <div className="staff-row" key={row.user?.id || index}>
            <Avatar name={row.user?.full_name || 'Staff'} />
            <div>
              <div className="n">{row.user?.full_name || 'Unknown'}</div>
              <div className="r">{row.user?.role || 'staff'}</div>
            </div>
            <div className="c num">{row.changes}</div>
          </div>
        ))
      )}
    </Panel>
  );
}
