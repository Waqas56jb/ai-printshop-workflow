import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../components/staff/ConfirmDialog.jsx';
import { PasswordDialog } from '../../components/staff/PasswordDialog.jsx';
import { RolesCard } from '../../components/staff/RolesCard.jsx';
import { StaffModal } from '../../components/staff/StaffModal.jsx';
import { StaffStats } from '../../components/staff/StaffStats.jsx';
import { StaffTable } from '../../components/staff/StaffTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { getOmiSetupStatus } from '../../services/dashboard.service.js';
import { deleteUser, getUserStats, listUsers, registerStaff, resetPassword, updateUser } from '../../services/staff.service.js';

export default function StaffPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [temp, setTemp] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    const [rows, nextStats, omi] = await Promise.all([listUsers(), getUserStats(), getOmiSetupStatus()]);
    setUsers(rows || []);
    setStats(nextStats);
    setDevices(omi?.devices || []);
  }, []);

  useEffect(() => {
    load().catch((error) => toast(error.response?.data?.message || 'Failed to load staff'));
  }, [load]);

  async function handleSave(form) {
    if (editing) {
      await updateUser(editing.id, {
        full_name: form.full_name,
        role: form.role,
        job_title: form.job_title,
        email: form.email || null,
        omi_uid: form.omi_uid,
      });
      toast('Person updated');
    } else {
      await registerStaff({
        full_name: form.full_name,
        role: form.role,
        job_title: form.job_title,
        email: form.email,
        password: form.password,
        omi_uid: form.omi_uid,
      });
      toast('Person added');
      if (form.role !== 'worker' && form.password) {
        setTemp({ title: 'Temporary password', password: form.password });
      }
    }
    setModalOpen(false);
    setEditing(null);
    await load();
  }

  async function handleReset(user) {
    const result = await resetPassword(user.id);
    setTemp({ title: user.invite_status === 'invited' ? 'Invite password' : 'Temporary password', password: result.password });
    toast(user.invite_status === 'invited' ? 'Invite resent' : 'Password reset');
  }

  return (
    <main className="staff-page">
      <div className="intro">
        <div>
          <h2>Staff</h2>
          <p>Everyone who can sign in or speak to OMI. Admins manage everything; staff run jobs; workers only use voice and the board.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus />
          Add person
        </Button>
      </div>

      <StaffStats stats={stats} users={users} />
      <StaffTable
        users={users}
        onEdit={(user) => {
          setEditing(user);
          setModalOpen(true);
        }}
        onReset={(user) => handleReset(user).catch((error) => toast(error.response?.data?.message || 'Could not reset password'))}
        onToggle={(user) => {
          const inactive = user.invite_status === 'inactive' || user.is_active === false;
          updateUser(user.id, { is_active: inactive, invite_status: inactive ? 'active' : 'inactive' })
            .then(() => {
              toast(inactive ? 'Reactivated' : 'Deactivated');
              return load();
            })
            .catch((error) => toast(error.response?.data?.message || 'Could not update'));
        }}
        onUnpair={(user) => {
          updateUser(user.id, { omi_uid: null })
            .then(() => {
              toast('OMI unpaired');
              return load();
            })
            .catch((error) => toast(error.response?.data?.message || 'Could not unpair'));
        }}
        onDelete={(user) => setConfirm(user)}
      />
      <RolesCard />

      <StaffModal
        open={modalOpen}
        person={editing}
        devices={devices}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
      <PasswordDialog open={Boolean(temp)} title={temp?.title} password={temp?.password} onClose={() => setTemp(null)} />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete this person?"
        body={confirm ? `${confirm.full_name} will lose access immediately.` : ''}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await deleteUser(confirm.id);
          toast('Person deleted');
          setConfirm(null);
          await load();
        }}
      />
    </main>
  );
}
