import { Link } from 'react-router-dom';

export function Panel({ title, actionTo, actionLabel, children, className = '' }) {
  return (
    <div className={`panel ${className}`.trim()}>
      {title ? (
        <div className="panel-head">
          <h3>{title}</h3>
          {actionTo && actionLabel ? <Link to={actionTo}>{actionLabel}</Link> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
