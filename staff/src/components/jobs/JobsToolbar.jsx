import { useEffect, useState } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { Button } from '../ui/Button.jsx';

export function JobsToolbar({
  search,
  priority,
  mine,
  due,
  onSearch,
  onPriority,
  onMine,
  onDue,
  customerName,
  onClearCustomer,
  onNewJob,
}) {
  const [draft, setDraft] = useState(search || '');

  useEffect(() => {
    setDraft(search || '');
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== (search || '')) onSearch(draft);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, search, onSearch]);

  return (
    <div className="toolbar">
      <label className="field search">
        <Search />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search job number, customer, title"
        />
      </label>
      <label className="field">
        <select value={priority || ''} onChange={(event) => onPriority(event.target.value)}>
          <option value="">Any priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <ChevronDown />
      </label>
      <div className="mine-toggle">
        <button type="button" className={mine ? 'on' : ''} onClick={() => onMine(true)}>
          Mine
        </button>
        <button type="button" className={!mine ? 'on' : ''} onClick={() => onMine(false)}>
          Everyone
        </button>
      </div>
      <label className="field">
        <select value={due || ''} onChange={(event) => onDue(event.target.value)}>
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="this_week">This week</option>
          <option value="next_week">Next week</option>
        </select>
        <ChevronDown />
      </label>
      {customerName ? (
        <button type="button" className="filter-chip" onClick={onClearCustomer}>
          {customerName} ×
        </button>
      ) : null}
      <div className="spacer"></div>
      <Button onClick={onNewJob}>
        <Plus />
        New job
      </Button>
    </div>
  );
}
