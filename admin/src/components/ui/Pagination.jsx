export function Pagination({ page, total, limit, onPage, noun = 'jobs' }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (limit || 20)));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  const numbers = [];
  for (let i = 1; i <= pages; i += 1) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) {
      numbers.push(i);
    } else if (numbers[numbers.length - 1] !== '…') {
      numbers.push('…');
    }
  }

  return (
    <div className="foot">
      <span>
        Showing {start}–{end} of {total}{noun ? ` ${noun}` : ''}
      </span>
      <div className="pages">
        <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
          ‹
        </button>
        {numbers.map((item, index) =>
          item === '…' ? (
            <button key={`e-${index}`} type="button" disabled>
              …
            </button>
          ) : (
            <button
              key={item}
              type="button"
              className={item === page ? 'on' : ''}
              onClick={() => onPage(item)}
            >
              {item}
            </button>
          )
        )}
        <button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}>
          ›
        </button>
      </div>
    </div>
  );
}
