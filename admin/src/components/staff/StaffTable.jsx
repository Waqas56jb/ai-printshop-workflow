import { useEffect, useState } from 'react';
import { MoreVertical, Pencil } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import { formatRelative, isSameDay } from '../../utils/date.js';

function omiLabel(user) {
  if (!user.omi_uid) return { text: 'Not paired', none: true, stale: false };
  const at = user.omi_last_heard_at;
  if (!at) return { text: 'Paired', none: false, stale: true };
  const date = new Date(at);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return { text: 'Yesterday', none: false, stale: true };
  }
  if (!isSameDay(at) && Date.now() - date.getTime() > 86400000) {
    return { text: formatRelative(at), none: false, stale: true };
  }
  return { text: formatRelative(at), none: false, stale: false };
}

function statusPill(user) {
  if (user.invite_status === 'invited') return { cls: 'invite', label: 'Invited' };
  if (user.invite_status === 'inactive' || user.is_active === false) return { cls: 'off', label: 'Inactive' };
  return { cls: 'ok', label: 'Active' };
}

function subtitle(user) {
  if (user.role === 'worker') {
    return user.job_title ? `No login · ${user.job_title}` : 'No login';
  }
  return user.job_title ? `${user.email} · ${user.job_title}` : user.email;
}

export function StaffTable({ users, onEdit, onReset, onToggle, onUnpair, onDelete }) {
  const [menuId, setMenuId] = useState(null);

  useEffect(() => {
    function onDoc() {
      setMenuId(null);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return (
    <div className="panel">
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Role</th>
            <th>Workload</th>
            <th>Done / wk</th>
            <th>Voice today</th>
            <th>OMI</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const omi = omiLabel(user);
            const status = statusPill(user);
            const jobs = user.active_jobs || 0;
            const hot = jobs >= 5;
            const width = `${Math.min(100, Math.round((jobs / 6) * 100))}%`;
            const worker = user.role === 'worker';
            const invited = user.invite_status === 'invited';
            const inactive = user.invite_status === 'inactive' || user.is_active === false;
            return (
              <tr key={user.id}>
                <td>
                  <div className="who">
                    <Avatar name={user.full_name} className={user.role === 'admin' ? 'admin' : ''} />
                    <div>
                      <div className="n">{user.full_name}</div>
                      <div className="c">{subtitle(user)}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`pill ${user.role}`}>{user.role === 'admin' ? 'Admin' : user.role === 'staff' ? 'Staff' : 'Worker'}</span>
                </td>
                <td>
                  {worker ? (
                    <span style={{ color: 'var(--ink-3)' }}>—</span>
                  ) : (
                    <div className={`load ${hot ? 'hot' : ''}`.trim()}>
                      <i style={{ '--w': width }}></i>
                      {jobs} job{jobs === 1 ? '' : 's'}
                    </div>
                  )}
                </td>
                <td className="num">
                  {worker ? <span style={{ color: 'var(--ink-3)' }}>—</span> : user.done_this_week || 0}
                </td>
                <td className="num">{user.voice_today || 0}</td>
                <td>
                  <div className={`omi-cell ${omi.none ? 'none' : ''}`.trim()}>
                    {omi.none ? null : <span className="dot" style={omi.stale ? { background: 'var(--ink-3)' } : undefined}></span>}
                    {omi.text}
                  </div>
                </td>
                <td>
                  <span className={`pill ${status.cls}`}>{status.label}</span>
                </td>
                <td>
                  <div className="row-ops">
                    {invited ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onReset(user)}>
                        Resend
                      </button>
                    ) : (
                      <button type="button" className="icon-btn" aria-label="Edit" onClick={() => onEdit(user)}>
                        <Pencil />
                      </button>
                    )}
                    {user.role !== 'admin' ? (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="More"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuId(menuId === user.id ? null : user.id);
                        }}
                      >
                        <MoreVertical />
                      </button>
                    ) : null}
                    {user.role !== 'admin' && menuId === user.id ? (
                      <div className="more-menu" onClick={(event) => event.stopPropagation()}>
                        {!worker && !invited ? (
                          <button type="button" onClick={() => { setMenuId(null); onReset(user); }}>
                            Reset password
                          </button>
                        ) : null}
                        <button type="button" onClick={() => { setMenuId(null); onToggle(user); }}>
                          {inactive ? 'Reactivate' : 'Deactivate'}
                        </button>
                        {user.omi_uid ? (
                          <button type="button" onClick={() => { setMenuId(null); onUnpair(user); }}>
                            Unpair OMI
                          </button>
                        ) : null}
                        <button type="button" className="danger" onClick={() => { setMenuId(null); onDelete(user); }}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
