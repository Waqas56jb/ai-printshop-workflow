import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '../ui/Avatar.jsx';
import { updateUser } from '../../services/dashboard.service.js';
import { formatRelative } from '../../utils/date.js';

function shortUid(uid = '') {
  if (uid.length < 12) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

export function OmiDevices({ devices = [], users = [], onChanged }) {
  const [menu, setMenu] = useState(null);
  const staff = users.filter((user) => user.is_active !== false);
  const assignedUids = new Set(staff.map((user) => user.omi_uid).filter(Boolean));

  async function assign(omiUid, userId) {
    try {
      await updateUser(userId, { omi_uid: omiUid });
      toast('Device assigned');
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not assign device');
    }
  }

  async function unassign(userId) {
    try {
      await updateUser(userId, { omi_uid: null });
      toast('Device unassigned');
      setMenu(null);
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not unassign device');
    }
  }

  return (
    <section className="panel devices">
      <div className="panel-head">
        <h3>Devices</h3>
      </div>
      {devices.length === 0 ? (
        <div className="setting">
          <div className="t">
            <b>No devices yet</b>
            <span>A device appears here after it sends its first transcript</span>
          </div>
        </div>
      ) : (
        devices.map((device) => {
          const user = device.user;
          const unassigned = !user;
          return (
            <div className="setting" key={device.omi_uid}>
              <Avatar name={user?.full_name || '?'} />
              <div className="t">
                <b>{user?.full_name || 'Unassigned device'}</b>
                <span>
                  {shortUid(device.omi_uid)} · {unassigned ? 'first' : 'last'} heard{' '}
                  {formatRelative(unassigned ? device.first_heard_at : device.last_heard_at)}
                </span>
              </div>
              {unassigned ? (
                <>
                  <span className="pill new">New</span>
                  <label className="field" style={{ width: 160 }}>
                    <select defaultValue="" onChange={(event) => event.target.value && assign(device.omi_uid, event.target.value)}>
                      <option value="">Assign to…</option>
                      {staff
                        .filter((item) => !assignedUids.has(item.omi_uid))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.full_name}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <span className="pill ok">Active</span>
                  <div style={{ position: 'relative' }}>
                    <button type="button" className="icon-btn" onClick={() => setMenu(menu === device.omi_uid ? null : device.omi_uid)}>
                      <MoreVertical />
                    </button>
                    {menu === device.omi_uid ? (
                      <div className="more-menu">
                        <button type="button" onClick={() => unassign(user.id)}>
                          Unassign
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
