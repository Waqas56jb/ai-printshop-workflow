const LINKS = [
  { id: 'shop', label: 'Shop' },
  { id: 'board', label: 'Job board' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'notify', label: 'Notifications' },
  { id: 'account', label: 'My account' },
  { id: 'danger', label: 'Danger zone' },
];

export function SettingsNav({ active }) {
  function go(event, id) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="snav">
      {LINKS.map((link) => (
        <a key={link.id} href={`#${link.id}`} className={active === link.id ? 'on' : ''} onClick={(event) => go(event, link.id)}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}
