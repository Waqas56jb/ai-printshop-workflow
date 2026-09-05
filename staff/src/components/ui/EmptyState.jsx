import { Link } from 'react-router-dom';
import { Button } from './Button.jsx';

export function EmptyState({
  message = 'No jobs yet — create your first job',
  to = '/jobs/new',
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty">
      <p>{message}</p>
      {onAction ? (
        <Button variant="ghost" onClick={onAction}>
          {actionLabel || 'Clear filters'}
        </Button>
      ) : (
        <Link to={to}>
          <Button>{actionLabel || 'New job'}</Button>
        </Link>
      )}
    </div>
  );
}
