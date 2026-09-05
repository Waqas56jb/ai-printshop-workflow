import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../components/staff/ConfirmDialog.jsx';
import { AccountSection } from '../../components/settings/AccountSection.jsx';
import { BoardSection } from '../../components/settings/BoardSection.jsx';
import { DangerSection } from '../../components/settings/DangerSection.jsx';
import { JobsSection } from '../../components/settings/JobsSection.jsx';
import { NotificationsSection } from '../../components/settings/NotificationsSection.jsx';
import { SettingsNav } from '../../components/settings/SettingsNav.jsx';
import { ShopSection } from '../../components/settings/ShopSection.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { changePassword, signOutEverywhere, updateMe } from '../../services/auth.service.js';
import {
  cleanupJobs,
  exportData,
  getSettings,
  regenerateOmiSecret,
  updateSettings,
  uploadLogo,
} from '../../services/settings.service.js';
import { useSettingsStore } from '../../store/settingsStore.js';

const NAV_IDS = ['shop', 'board', 'jobs', 'notify', 'account', 'danger'];

function buildForm(settings, profile) {
  const hours = settings.working_hours || {};
  return {
    business_logo_url: settings.business_logo_url || '',
    business_name: settings.business_name || 'Print Shop',
    phone: settings.phone || '',
    address: settings.address || '',
    currency: settings.currency || 'PKR',
    hours_mon_fri_open: hours.mon_fri?.open || '09:00',
    hours_mon_fri_close: hours.mon_fri?.close || '19:00',
    hours_sat_open: hours.saturday?.open || '10:00',
    hours_sat_close: hours.saturday?.close || '17:00',
    board_theme: settings.board_theme || 'dark',
    board_card_size: settings.board_card_size || 'normal',
    board_show_customer: settings.board_show_customer !== false,
    board_show_due: settings.board_show_due !== false,
    board_overdue_highlight: settings.board_overdue_highlight !== false,
    board_hide_delivered_after: Number(settings.board_hide_delivered_after ?? 2),
    board_refresh_seconds: Number(settings.board_refresh_seconds ?? 30),
    board_key: settings.board_key || '',
    job_number_prefix: settings.job_number_prefix || 'J-',
    job_number_next: settings.job_number_next,
    default_due_days: Number(settings.default_due_days ?? 3),
    default_priority: settings.default_priority || 'normal',
    product_types: settings.product_types || [],
    print_types: settings.print_types || [],
    require_artwork_before_printing: settings.require_artwork_before_printing !== false,
    notify_email: settings.notify_email || profile?.email || '',
    notify_overdue_email: settings.notify_overdue_email !== false,
    notify_pending_voice: settings.notify_pending_voice !== false,
    notify_daily_summary: Boolean(settings.notify_daily_summary),
    account_name: profile?.full_name || '',
    account_email: profile?.email || '',
  };
}

function settingsPayload(form) {
  return {
    business_logo_url: form.business_logo_url,
    business_name: form.business_name,
    phone: form.phone,
    address: form.address,
    currency: form.currency,
    working_hours: {
      mon_fri: { open: form.hours_mon_fri_open, close: form.hours_mon_fri_close },
      saturday: { open: form.hours_sat_open, close: form.hours_sat_close },
      sunday: null,
    },
    board_theme: form.board_theme,
    board_card_size: form.board_card_size,
    board_show_customer: form.board_show_customer,
    board_show_due: form.board_show_due,
    board_overdue_highlight: form.board_overdue_highlight,
    board_hide_delivered_after: form.board_hide_delivered_after,
    board_refresh_seconds: form.board_refresh_seconds,
    job_number_prefix: form.job_number_prefix,
    default_due_days: form.default_due_days,
    default_priority: form.default_priority,
    product_types: form.product_types,
    print_types: form.print_types,
    require_artwork_before_printing: form.require_artwork_before_printing,
    notify_email: form.notify_email,
    notify_overdue_email: form.notify_overdue_email,
    notify_pending_voice: form.notify_pending_voice,
    notify_daily_summary: form.notify_daily_summary,
  };
}

export default function SettingsPage() {
  const { profile, setProfile, logout } = useAuth();
  const setSettings = useSettingsStore((state) => state.setSettings);
  const [form, setForm] = useState(() => buildForm({}, profile));
  const [baseline, setBaseline] = useState('');
  const [active, setActive] = useState('shop');
  const [saving, setSaving] = useState(false);
  const [danger, setDanger] = useState(null);

  const load = useCallback(async () => {
    const settings = await getSettings();
    const next = buildForm(settings, profile);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setSettings(settings);
  }, [profile, setSettings]);

  useEffect(() => {
    load().catch((error) => toast(error.response?.data?.message || 'Failed to load settings'));
  }, [load]);

  useEffect(() => {
    function onScroll() {
      let current = NAV_IDS[0];
      for (const id of NAV_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 120) current = id;
      }
      setActive(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dirty = useMemo(() => baseline && JSON.stringify(form) !== baseline, [form, baseline]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const settings = await updateSettings(settingsPayload(form));
      const me = await updateMe({ full_name: form.account_name, email: form.account_email });
      setProfile(me);
      setSettings(settings);
      const next = buildForm(settings, me);
      setForm(next);
      setBaseline(JSON.stringify(next));
      toast('Settings saved');
    } catch (error) {
      toast(error.response?.data?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="settings-page">
      <div className="intro">
        <div>
          <h2>Settings</h2>
          <p>Shop details, job board display, notifications, and account.</p>
        </div>
      </div>

      <div className="settings">
        <SettingsNav active={active} />
        <div className="sections">
          <ShopSection
            form={form}
            setField={setField}
            onUpload={async (file) => {
              try {
                const result = await uploadLogo(file);
                setField('business_logo_url', result.url);
                setSettings({ ...useSettingsStore.getState().settings, business_logo_url: result.url });
                toast('Logo uploaded');
              } catch (error) {
                toast(error.response?.data?.message || 'Could not upload logo');
              }
            }}
          />
          <BoardSection form={form} setField={setField} />
          <JobsSection form={form} setField={setField} />
          <NotificationsSection form={form} setField={setField} />
          <AccountSection
            form={form}
            setField={setField}
            profile={profile}
            onChangePassword={async (payload) => {
              await changePassword(payload);
              toast('Password changed');
            }}
            onSignOut={async () => {
              await signOutEverywhere();
              await logout();
            }}
          />
          <DangerSection
            onExport={async () => {
              try {
                const blob = await exportData();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'printshop-export.zip';
                link.click();
                URL.revokeObjectURL(url);
                toast('Export downloaded');
              } catch (error) {
                toast(error.response?.data?.message || 'Could not export');
              }
            }}
            onClear={() => setDanger('clear')}
            onRegenOmi={() => setDanger('omi')}
          />
          {dirty ? (
            <div className="save-bar">
              Unsaved changes
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(JSON.parse(baseline))}>
                Discard
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={danger === 'clear'}
        title="Clear old delivered jobs?"
        body="This permanently deletes completed jobs older than a year."
        confirmLabel="Clear"
        danger
        requireText="CONFIRM"
        onClose={() => setDanger(null)}
        onConfirm={async () => {
          const result = await cleanupJobs(365);
          toast(`Cleared ${result.deleted || 0} jobs`);
          setDanger(null);
        }}
      />
      <ConfirmDialog
        open={danger === 'omi'}
        title="Regenerate OMI webhook secret?"
        body="Every device must be reconnected."
        confirmLabel="Regenerate"
        danger
        requireText="CONFIRM"
        onClose={() => setDanger(null)}
        onConfirm={async () => {
          await regenerateOmiSecret();
          toast('OMI secret regenerated');
          setDanger(null);
        }}
      />
    </main>
  );
}
