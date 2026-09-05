import { useEffect, useState } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { Button } from '../ui/Button.jsx';

export function CustomersToolbar({ search, filter, sort, onSearch, onFilter, onSort, onAdd }) {
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
          placeholder="Search name, phone, company"
        />
      </label>
      <label className="field">
        <select value={filter || ''} onChange={(event) => onFilter(event.target.value)}>
          <option value="">All customers</option>
          <option value="active">With active jobs</option>
          <option value="none">No jobs yet</option>
        </select>
        <ChevronDown />
      </label>
      <label className="field">
        <select value={sort || 'recent'} onChange={(event) => onSort(event.target.value)}>
          <option value="recent">Recently active</option>
          <option value="name">Name A–Z</option>
          <option value="jobs">Most jobs</option>
        </select>
        <ChevronDown />
      </label>
      <div className="spacer"></div>
      <Button onClick={onAdd}>
        <Plus />
        Add customer
      </Button>
    </div>
  );
}
